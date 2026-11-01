import { asc, eq, sql, type SQL } from 'drizzle-orm';
import type { Db } from '@/db/client';
import * as s from '@/db/schema';
import { pragueDay } from '@/domain/format/date';
import { parsePragueDateTime } from '@/domain/format/pragueLocal';
import { newId } from '@/domain/ids';
import { checkPublicationUrl, groupVariants, metricRates, normalizeMetrics } from '@/domain/metrics/publication';
import { can } from '@/domain/policy/can';
import { logActivity } from './activity';
import type { Actor } from './actor';
import { allLookups, type LookupRow } from './editorOptions';
import { DomainError } from './errors';
import { loadVideo, type Executor } from './loaders';

const forbidden = () => new DomainError('FORBIDDEN', 'K této akci nemáš oprávnění.');

export interface PublicationInput {
  profileKey: string;
  /** `YYYY-MM-DDTHH:mm` in Prague time, or an ISO instant. */
  publishedAt: string;
  variant: string;
  url: string;
  note: string;
  metrics24h?: Record<string, unknown> | null;
  metrics7d?: Record<string, unknown> | null;
}

interface Clean {
  profileKey: string;
  publishedAt: Date;
  variant: string;
  url: string;
  note: string;
  metrics24h: Record<string, number> | null;
  metrics7d: Record<string, number> | null;
}

async function clean(tx: Executor, input: PublicationInput): Promise<Clean> {
  const lookups = await tx.select({ kind: s.lookupItems.kind, key: s.lookupItems.key }).from(s.lookupItems);
  const has = (kind: string, key: string) => lookups.some((l) => l.kind === kind && l.key === key);
  if (!has('profile', input.profileKey)) throw new DomainError('VALIDATION', 'Vyber profil.');
  if (!has('publication_variant', input.variant)) throw new DomainError('VALIDATION', 'Vyber variantu publikace.');
  const publishedAt = parsePragueDateTime(input.publishedAt);
  if (!publishedAt) throw new DomainError('VALIDATION', 'Zadej datum a čas publikace.');
  const url = input.url.trim();
  const urlError = checkPublicationUrl(url);
  if (urlError) throw new DomainError('VALIDATION', urlError);
  const metrics = [normalizeMetrics(input.metrics24h), normalizeMetrics(input.metrics7d)];
  for (const m of metrics) if (!m.ok) throw new DomainError('VALIDATION', m.message);
  const [m24, m7] = metrics.map((m) => (m.ok ? m.metrics : null));
  return { profileKey: input.profileKey, publishedAt, variant: input.variant, url, note: input.note.trim(), metrics24h: m24, metrics7d: m7 };
}

const countFor = async (tx: Executor, videoId: string) =>
  (await tx.select({ n: sql<number>`count(*)::int` }).from(s.publications).where(eq(s.publications.videoId, videoId)))[0].n;

/** Adds a publication of an approved script; the first one sets the production status to Publikováno. */
export async function addPublication(db: Db, actor: Actor, videoId: string, input: PublicationInput, now: Date): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    if (!can(actor, 'publication.manage')) throw forbidden();
    const video = await loadVideo(tx, videoId, { lock: true });
    if (video.approvalStatus !== 'approved') throw new DomainError('VALIDATION', `${video.code} není schválený, publikaci lze přidat jen ke schválenému scénáři.`);
    const values = await clean(tx, input);
    const id = newId();
    await tx.insert(s.publications).values({ id, videoId, ...values });
    if (video.productionStatus !== 'published') await tx.update(s.videos).set({ productionStatus: 'published', updatedAt: now }).where(eq(s.videos.id, videoId));
    await logActivity(tx, { actorId: actor.id, videoId, entity: 'publication', entityId: id, action: 'publication.added', after: { code: video.code, variant: values.variant, profileKey: values.profileKey } }, now);
    return { id };
  });
}

async function loadPublication(tx: Executor, id: string) {
  const [row] = await tx.select().from(s.publications).where(eq(s.publications.id, id));
  if (!row) throw new DomainError('NOT_FOUND', 'Publikace nenalezena.');
  return row;
}

export async function updatePublication(db: Db, actor: Actor, id: string, input: PublicationInput, now: Date): Promise<void> {
  await db.transaction(async (tx) => {
    if (!can(actor, 'publication.manage')) throw forbidden();
    const row = await loadPublication(tx, id);
    const video = await loadVideo(tx, row.videoId);
    const values = await clean(tx, input);
    await tx.update(s.publications).set(values).where(eq(s.publications.id, id));
    await logActivity(tx, { actorId: actor.id, videoId: row.videoId, entity: 'publication', entityId: id, action: 'publication.updated', after: { code: video.code, variant: values.variant } }, now);
  });
}

/** Deleting the last publication takes Publikováno back to Sestříháno (the status needs a publication). */
export async function deletePublication(db: Db, actor: Actor, id: string, now: Date): Promise<void> {
  await db.transaction(async (tx) => {
    if (!can(actor, 'publication.manage')) throw forbidden();
    const row = await loadPublication(tx, id);
    const video = await loadVideo(tx, row.videoId, { lock: true });
    await tx.delete(s.publications).where(eq(s.publications.id, id));
    if (video.productionStatus === 'published' && (await countFor(tx, video.id)) === 0) {
      await tx.update(s.videos).set({ productionStatus: 'edited', updatedAt: now }).where(eq(s.videos.id, video.id));
    }
    await logActivity(tx, { actorId: actor.id, videoId: video.id, entity: 'publication', entityId: id, action: 'publication.deleted', after: { code: video.code, variant: row.variant } }, now);
  });
}

export interface Option {
  key: string;
  label: string;
}

export interface PublicationVM {
  id: string;
  videoId: string;
  code: string;
  title: string;
  profileKey: string;
  profileLabel: string;
  publishedAt: string;
  variant: string;
  variantLabel: string;
  url: string;
  note: string;
  metrics24h: Record<string, number> | null;
  metrics7d: Record<string, number> | null;
  reach7d: number | null;
  shareRate7d: number | null;
}

const labels = (lookups: LookupRow[], kind: string) => new Map(lookups.filter((l) => l.kind === kind).map((l) => [l.key, l.label]));
const options = (lookups: LookupRow[], kind: string): Option[] => lookups.filter((l) => l.kind === kind && !l.archived).map((l) => ({ key: l.key, label: l.label }));

function publicationRows(db: Db, where: SQL) {
  return db
    .select({
      id: s.publications.id,
      videoId: s.publications.videoId,
      code: s.videos.code,
      title: s.videos.title,
      profileKey: s.publications.profileKey,
      publishedAt: s.publications.publishedAt,
      variant: s.publications.variant,
      url: s.publications.url,
      note: s.publications.note,
      metrics24h: s.publications.metrics24h,
      metrics7d: s.publications.metrics7d,
    })
    .from(s.publications)
    .innerJoin(s.videos, eq(s.videos.id, s.publications.videoId))
    .where(where)
    .orderBy(asc(s.publications.publishedAt), asc(s.publications.id));
}

function toVM(row: Awaited<ReturnType<typeof publicationRows>>[number], lookups: LookupRow[]): PublicationVM {
  const profiles = labels(lookups, 'profile');
  const variants = labels(lookups, 'publication_variant');
  return {
    ...row,
    publishedAt: row.publishedAt.toISOString(),
    profileLabel: profiles.get(row.profileKey) ?? row.profileKey,
    variantLabel: variants.get(row.variant) ?? row.variant,
    reach7d: row.metrics7d?.reach ?? null,
    shareRate7d: metricRates(row.metrics7d).shareRate,
  };
}

/** A publication as the script page's head query aggregates it (timestamps are ISO strings). */
export interface RawPublication {
  id: string;
  profileKey: string;
  publishedAt: string;
  variant: string;
  url: string;
  note: string;
  metrics24h: Record<string, number> | null;
  metrics7d: Record<string, number> | null;
}

export interface PublicationBlock {
  publications: PublicationVM[];
  profiles: Option[];
  variants: Option[];
}

/** The „Publikace“ block of a script page, built from the head query's rows and the lookups already loaded. */
export function publicationBlock(raw: RawPublication[], video: { id: string; code: string; title: string }, lookups: LookupRow[]): PublicationBlock {
  return {
    publications: raw.map((r) => toVM({ ...r, publishedAt: new Date(r.publishedAt), videoId: video.id, code: video.code, title: video.title }, lookups)),
    profiles: options(lookups, 'profile'),
    variants: options(lookups, 'publication_variant'),
  };
}

export interface PublicationsPage {
  month: string;
  /** Rows after the „Bez odkazu“ filter, newest first. */
  rows: PublicationVM[];
  /** Counts of the whole month (not the filtered rows): several publications of one video count once as a video. */
  publicationCount: number;
  videoCount: number;
  withoutUrl: number;
  /** Videos published in more than one variant. */
  groups: { videoId: string; code: string; title: string; rows: PublicationVM[] }[];
}

/** `/publikace`: publications of the scripts planned in `month` (2 queries). */
export async function loadPublicationsPage(db: Db, month: string, noLinkOnly: boolean): Promise<PublicationsPage> {
  const [rows, lookups] = await Promise.all([publicationRows(db, eq(s.videos.plannedMonth, month)), allLookups(db)]);
  const all = rows.map((r) => toVM(r, lookups));
  return {
    month,
    rows: [...(noLinkOnly ? all.filter((r) => r.url === '') : all)].reverse(),
    publicationCount: all.length,
    videoCount: new Set(all.map((r) => r.videoId)).size,
    withoutUrl: all.filter((r) => r.url === '').length,
    groups: groupVariants(all).map((g) => ({ videoId: g[0].videoId, code: g[0].code, title: g[0].title, rows: g })),
  };
}

/** Prague month of `now`, for the default of the month filter. */
export const currentMonthOf = (now: Date) => pragueDay(now).slice(0, 7);
