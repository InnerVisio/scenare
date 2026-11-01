import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import * as s from '@/db/schema';
import { newId } from '@/domain/ids';
import { can } from '@/domain/policy/can';
import { computeSeriesMetrics, type SeriesMetrics } from '@/domain/series/metrics';
import { SERIES_STATUSES } from '@/domain/series/status';
import { logActivity } from './activity';
import type { Actor } from './actor';
import { DomainError } from './errors';
import type { Executor } from './loaders';
import { createVideo } from './videos';

export type SeriesRow = typeof s.series.$inferSelect;

export interface SeriesPatch {
  name?: string;
  mainCategoryKey?: string | null;
  goal?: string;
  guarantorId?: string | null;
  plannedEpisodes?: number | null;
  scopeChangeReason?: string;
  startDate?: string | null;
  expectedEnd?: string | null;
  note?: string;
  status?: string;
}

const forbidden = () => new DomainError('FORBIDDEN', 'K této akci nemáš oprávnění.');
const requireManage = (actor: Actor) => {
  if (!can(actor, 'series.manage')) throw forbidden();
};

async function loadSeriesRow(tx: Executor, id: string, lock = false): Promise<SeriesRow> {
  const query = tx.select().from(s.series).where(eq(s.series.id, id));
  const [row] = await (lock ? query.for('update') : query);
  if (!row) throw new DomainError('NOT_FOUND', 'Série nenalezena.');
  return row;
}

function nextCode(codes: string[]): string {
  const max = codes.reduce((m, code) => {
    const match = /^S(\d+)$/.exec(code);
    return match ? Math.max(m, Number(match[1])) : m;
  }, 0);
  return `S${String(max + 1).padStart(2, '0')}`;
}

function checkPlanned(value: number | null | undefined): void {
  if (value != null && (!Number.isInteger(value) || value < 1 || value > 200)) {
    throw new DomainError('VALIDATION', 'Plánovaný počet dílů musí být celé číslo od 1 do 200.');
  }
}

async function checkGuarantor(tx: Executor, id: string | null | undefined): Promise<void> {
  if (!id) return;
  const [user] = await tx.select({ role: s.users.role }).from(s.users).where(eq(s.users.id, id));
  if (user?.role !== 'leadership') throw new DomainError('VALIDATION', 'Garant série musí být z vedení.');
}

export async function createSeries(
  db: Db,
  actor: Actor,
  input: Omit<SeriesPatch, 'status' | 'scopeChangeReason'> & { name: string },
  now: Date,
): Promise<{ id: string; code: string }> {
  return db.transaction(async (tx) => {
    requireManage(actor);
    const name = input.name.trim();
    if (!name) throw new DomainError('VALIDATION', 'Zadej název série.');
    checkPlanned(input.plannedEpisodes);
    await checkGuarantor(tx, input.guarantorId);
    await tx.execute(sql`select pg_advisory_xact_lock(${7_100_002})`);
    const code = nextCode((await tx.select({ code: s.series.code }).from(s.series)).map((r) => r.code));
    const id = newId();
    await tx.insert(s.series).values({
      id,
      code,
      name,
      mainCategoryKey: input.mainCategoryKey ?? null,
      goal: input.goal ?? '',
      guarantorId: input.guarantorId ?? null,
      ownerId: actor.id,
      plannedEpisodes: input.plannedEpisodes ?? null,
      originalPlannedEpisodes: input.plannedEpisodes ?? null,
      startDate: input.startDate ?? null,
      expectedEnd: input.expectedEnd ?? null,
      note: input.note ?? '',
      status: 'active',
    });
    await logActivity(tx, { actorId: actor.id, videoId: null, entity: 'series', entityId: id, action: 'series.created', after: { code, name } }, now);
    return { id, code };
  });
}

export async function updateSeries(db: Db, actor: Actor, id: string, patch: SeriesPatch, now: Date): Promise<void> {
  await db.transaction(async (tx) => {
    requireManage(actor);
    const current = await loadSeriesRow(tx, id, true);
    const set: Partial<typeof s.series.$inferInsert> = {};

    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name) throw new DomainError('VALIDATION', 'Zadej název série.');
      set.name = name;
    }
    if (patch.mainCategoryKey !== undefined) set.mainCategoryKey = patch.mainCategoryKey;
    if (patch.goal !== undefined) set.goal = patch.goal;
    if (patch.note !== undefined) set.note = patch.note;
    if (patch.startDate !== undefined) set.startDate = patch.startDate;
    if (patch.expectedEnd !== undefined) set.expectedEnd = patch.expectedEnd;
    if (patch.guarantorId !== undefined) {
      await checkGuarantor(tx, patch.guarantorId);
      set.guarantorId = patch.guarantorId;
    }
    if (patch.status !== undefined && patch.status !== current.status) {
      if (!(SERIES_STATUSES as readonly string[]).includes(patch.status)) throw new DomainError('VALIDATION', 'Neznámý stav série.');
      if (patch.status === 'closed') throw new DomainError('VALIDATION', 'Sérii uzavři tlačítkem „Uzavřít sérii“.');
      set.status = patch.status;
      if (current.status === 'closed') Object.assign(set, { closedBy: null, closedAt: null });
    }
    if (patch.plannedEpisodes !== undefined && patch.plannedEpisodes !== current.plannedEpisodes) {
      checkPlanned(patch.plannedEpisodes);
      set.plannedEpisodes = patch.plannedEpisodes;
      if (current.originalPlannedEpisodes == null) {
        set.originalPlannedEpisodes = patch.plannedEpisodes;
      } else if (patch.plannedEpisodes !== current.originalPlannedEpisodes) {
        const reason = patch.scopeChangeReason?.trim() ?? '';
        if (!reason) throw new DomainError('VALIDATION', 'Zadej důvod změny rozsahu.');
        set.scopeChangeReason = reason;
      }
    }

    if (Object.keys(set).length === 0) return;
    await tx.update(s.series).set(set).where(eq(s.series.id, id));
    await logActivity(
      tx,
      { actorId: actor.id, videoId: null, entity: 'series', entityId: id, action: 'series.updated', before: { code: current.code }, after: { code: current.code, ...set } },
      now,
    );
  });
}

/** Counts the series check needs, one row per episode (comments and publications as subselects; drizzle drops the table prefix in single-table selects, hence the literal `videos.id`). */
function episodeSelect(db: Executor) {
  return db
    .select({
      id: s.videos.id,
      seriesId: s.videos.seriesId,
      code: s.videos.code,
      title: s.videos.title,
      episodeNo: s.videos.episodeNo,
      approvalStatus: s.videos.approvalStatus,
      productionStatus: s.videos.productionStatus,
      openRootComments: sql<number>`(select count(*)::int from ${s.comments} c where c.video_id = videos.id and c.parent_id is null and c.status = 'open')`,
      publications: sql<number>`(select count(*)::int from ${s.publications} p where p.video_id = videos.id)`,
      publicationsWithoutUrl: sql<number>`(select count(*)::int from ${s.publications} p where p.video_id = videos.id and btrim(p.url) = '')`,
    })
    .from(s.videos);
}
export type EpisodeRow = Awaited<ReturnType<typeof episodeSelect>>[number];

export async function closeSeries(db: Db, actor: Actor, id: string, now: Date): Promise<void> {
  await db.transaction(async (tx) => {
    if (!can(actor, 'series.close')) throw forbidden();
    const row = await loadSeriesRow(tx, id, true);
    if (row.status === 'closed') throw new DomainError('INVALID_TRANSITION', 'Série už je uzavřená.');
    const episodes = await episodeSelect(tx).where(eq(s.videos.seriesId, id));
    const metrics = computeSeriesMetrics(row, episodes);
    if (!metrics.canClose) throw new DomainError('VALIDATION', metrics.reasons.join(' '));
    await tx.update(s.series).set({ status: 'closed', closedBy: actor.id, closedAt: now }).where(eq(s.series.id, id));
    await logActivity(
      tx,
      { actorId: actor.id, videoId: null, entity: 'series', entityId: id, action: 'series.closed', before: { status: row.status }, after: { code: row.code, status: 'closed' } },
      now,
    );
  });
}

/** „+ Nový díl“: a draft in the series with the next episode number, in the series' category. */
export async function createEpisode(db: Db, actor: Actor, seriesId: string, now: Date): Promise<{ id: string; code: string }> {
  requireManage(actor);
  const row = await loadSeriesRow(db, seriesId);
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${s.videos.episodeNo}), 0)::int` })
    .from(s.videos)
    .where(eq(s.videos.seriesId, seriesId));
  const episodeNo = max + 1;
  return createVideo(
    db,
    actor,
    { title: `${row.name} – díl ${episodeNo}`, seriesId, episodeNo, categoryKey: row.mainCategoryKey },
    now,
  );
}

export interface SeriesSummary {
  id: string;
  code: string;
  name: string;
  mainCategoryKey: string | null;
  guarantorName: string | null;
  status: string;
  plannedEpisodes: number | null;
  metrics: SeriesMetrics;
}

/** All series with their metrics: two queries however many series and episodes there are. */
export async function loadSeriesList(db: Db): Promise<SeriesSummary[]> {
  const rows = await db
    .select({ series: s.series, guarantorName: s.users.name })
    .from(s.series)
    .leftJoin(s.users, eq(s.users.id, s.series.guarantorId))
    .orderBy(s.series.code);
  if (rows.length === 0) return [];
  const episodes = await episodeSelect(db).where(inArray(s.videos.seriesId, rows.map((r) => r.series.id)));
  return rows.map(({ series, guarantorName }) => ({
    id: series.id,
    code: series.code,
    name: series.name,
    mainCategoryKey: series.mainCategoryKey,
    guarantorName,
    status: series.status,
    plannedEpisodes: series.plannedEpisodes,
    metrics: computeSeriesMetrics(series, episodes.filter((e) => e.seriesId === series.id)),
  }));
}

export interface SeriesDetail {
  series: SeriesRow;
  guarantorName: string | null;
  closedByName: string | null;
  episodes: EpisodeRow[];
  metrics: SeriesMetrics;
}

export async function loadSeriesDetail(db: Db, code: string): Promise<SeriesDetail> {
  const [found] = await db
    .select({ series: s.series, guarantorName: s.users.name })
    .from(s.series)
    .leftJoin(s.users, eq(s.users.id, s.series.guarantorId))
    .where(eq(s.series.code, code));
  if (!found) throw new DomainError('NOT_FOUND', 'Série nenalezena.');
  const episodes = await episodeSelect(db)
    .where(and(eq(s.videos.seriesId, found.series.id)))
    .orderBy(s.videos.episodeNo, s.videos.code);
  let closedByName: string | null = null;
  if (found.series.closedBy) {
    const [u] = await db.select({ name: s.users.name }).from(s.users).where(eq(s.users.id, found.series.closedBy));
    closedByName = u?.name ?? null;
  }
  return {
    series: found.series,
    guarantorName: found.guarantorName,
    closedByName,
    episodes,
    metrics: computeSeriesMetrics(found.series, episodes),
  };
}
