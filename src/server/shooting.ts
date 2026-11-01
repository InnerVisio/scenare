import { eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import * as s from '@/db/schema';
import { daysUntil } from '@/domain/format/date';
import { buildCycleMix, countsTowardsMix } from '@/domain/metrics/mix';
import { can } from '@/domain/policy/can';
import type { ScriptBody } from '@/domain/script/types';
import { crewView, groupForShooting, shootingWarnings, type CrewView, type LocationGroup, type ShootingVideo } from '@/domain/shooting/plan';
import { checkProductionChange } from '@/domain/workflow/production';
import { logActivity } from './activity';
import type { Actor } from './actor';
import { signCrewLink, verifyCrewLink } from './auth/token';
import { allLookups, type LookupRow } from './editorOptions';
import { DomainError } from './errors';
import { mixItemsFrom } from './mix';

const forbidden = () => new DomainError('FORBIDDEN', 'K této akci nemáš oprávnění.');

/** Noon UTC of a `YYYY-MM-DD` day, so that Prague day arithmetic never crosses midnight. */
const noon = (iso: string) => new Date(`${iso}T12:00:00Z`);
function minusDays(iso: string, days: number): string {
  const d = noon(iso);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Cycles with the settings in one query, ordered like the shell (by shoot date). */
function cycleRows(db: Db) {
  return db
    .select({
      id: s.shootingCycles.id,
      shootDate: s.shootingCycles.shootDate,
      plannedVideos: s.shootingCycles.plannedVideos,
      clipTarget: s.shootingCycles.clipTarget,
      approvalDaysBefore: s.settings.approvalDaysBefore,
      tolerancePp: s.settings.tolerancePp,
    })
    .from(s.shootingCycles)
    .leftJoin(s.settings, eq(s.settings.id, 'global'))
    .orderBy(s.shootingCycles.shootDate, s.shootingCycles.id);
}
type CycleRow = Awaited<ReturnType<typeof cycleRows>>[number];

/** `?cyklus=` if it names a cycle, else the next shoot, else the latest cycle (the same rule as the shell). */
function pickCycle(rows: CycleRow[], param: string | undefined, today: string): CycleRow | undefined {
  const named = param ? rows.find((r) => r.id === param) : undefined;
  if (named) return named;
  const upcoming = rows.find((r) => r.shootDate !== null && r.shootDate >= today);
  return upcoming ?? [...rows].sort((a, b) => b.id.localeCompare(a.id))[0];
}

/** Every script of the cycle; approved ones carry the body of their latest version (one query, no per-script reads). */
async function cycleVideos(db: Db, cycleId: string) {
  const rows = await db
    .select({
      id: s.videos.id,
      code: s.videos.code,
      title: s.videos.title,
      locationKeys: s.videos.locationKeys,
      cast: s.videos.cast,
      props: s.videos.props,
      formatKey: s.videos.formatKey,
      approvalStatus: s.videos.approvalStatus,
      productionStatus: s.videos.productionStatus,
      categoryKey: s.videos.categoryKey,
      treatmentKey: s.videos.treatmentKey,
      profileKey: s.videos.profileKey,
      characterKey: s.videos.characterKey,
      // jsonb comes back as text through some drivers when it is not a mapped column.
      body: sql<ScriptBody | string | null>`case when videos.approval_status = 'approved'
        then (select sv.body from script_versions sv where sv.video_id = videos.id order by sv.version_no desc limit 1) end`,
    })
    .from(s.videos)
    .where(eq(s.videos.cycleId, cycleId))
    .orderBy(s.videos.code);
  return rows.map((r) => ({ ...r, body: typeof r.body === 'string' ? (JSON.parse(r.body) as ScriptBody) : r.body }));
}
type CycleVideo = Awaited<ReturnType<typeof cycleVideos>>[number];

const approved = (videos: CycleVideo[]): ShootingVideo[] =>
  videos
    .filter((v) => v.approvalStatus === 'approved')
    .map((v) => ({ id: v.id, code: v.code, title: v.title, locationKeys: v.locationKeys, cast: v.cast, props: v.props, formatKey: v.formatKey, productionStatus: v.productionStatus, body: v.body }));

const labelsOf = (lookups: LookupRow[], kind: string) => new Map(lookups.filter((l) => l.kind === kind).map((l) => [l.key, l.label]));

export interface ShootingDay {
  cycle: {
    id: string;
    shootDate: string | null;
    approvalDeadline: string | null;
    daysToShoot: number | null;
    daysToDeadline: number | null;
    clipTarget: string;
    plannedVideos: number;
  };
  groups: LocationGroup[];
  approvedCount: number;
  warnings: string[];
  formatLabels: Record<string, string>;
}

/** The shooting-day page in 3 queries: the cycles, the cycle's scripts and the lookups. */
export async function loadShootingDay(db: Db, cycleParam: string | undefined, now: Date): Promise<ShootingDay | null> {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const cycle = pickCycle(await cycleRows(db), cycleParam, today);
  if (!cycle) return null;
  const [videos, lookups] = await Promise.all([cycleVideos(db, cycle.id), allLookups(db)]);
  const deadline = cycle.shootDate ? minusDays(cycle.shootDate, cycle.approvalDaysBefore ?? 7) : null;
  const daysToDeadline = deadline ? daysUntil(noon(deadline), now) : null;
  const mix = buildCycleMix({ videos, plan: cycle.plannedVideos, tolerancePp: cycle.tolerancePp ?? 10, ...mixItemsFrom(lookups) });
  const shooting = approved(videos);
  return {
    cycle: {
      id: cycle.id,
      shootDate: cycle.shootDate,
      approvalDeadline: deadline,
      daysToShoot: cycle.shootDate ? daysUntil(noon(cycle.shootDate), now) : null,
      daysToDeadline,
      clipTarget: cycle.clipTarget,
      plannedVideos: cycle.plannedVideos,
    },
    groups: groupForShooting(shooting, labelsOf(lookups, 'location')),
    approvedCount: shooting.length,
    warnings: shootingWarnings({
      daysToDeadline,
      statuses: videos.map((v) => v.approvalStatus).filter(countsTowardsMix),
      missing: mix.categories.rows,
    }),
    formatLabels: Object.fromEntries(labelsOf(lookups, 'format')),
  };
}

export interface SetProductionInput {
  videoIds: string[];
  status: string;
  /** `YYYY-MM-DD`, only for „Natočeno“; defaults to now. */
  shotDate?: string | null;
}

/** Sets the production status of one or more scripts at once (all or none). */
export async function setProductionStatus(db: Db, actor: Actor, input: SetProductionInput, now: Date): Promise<void> {
  await db.transaction(async (tx) => {
    if (!can(actor, 'production.update')) throw forbidden();
    const ids = [...new Set(input.videoIds)];
    if (ids.length === 0) throw new DomainError('VALIDATION', 'Vyber aspoň jeden scénář.');
    if (input.shotDate != null && !/^\d{4}-\d{2}-\d{2}$/.test(input.shotDate)) throw new DomainError('VALIDATION', 'Zadej datum natáčení.');
    const rows = await tx.select().from(s.videos).where(inArray(s.videos.id, ids)).for('update');
    if (rows.length !== ids.length) throw new DomainError('NOT_FOUND', 'Scénář nenalezen.');
    const counts = await tx
      .select({ videoId: s.publications.videoId, n: sql<number>`count(*)::int` })
      .from(s.publications)
      .where(inArray(s.publications.videoId, ids))
      .groupBy(s.publications.videoId);
    const publications = new Map(counts.map((c) => [c.videoId, c.n]));
    for (const row of [...rows].sort((a, b) => a.code.localeCompare(b.code))) {
      const message = checkProductionChange({ code: row.code, to: input.status, approvalStatus: row.approvalStatus, publications: publications.get(row.id) ?? 0 });
      if (message) throw new DomainError('VALIDATION', message);
    }
    const set: Partial<typeof s.videos.$inferInsert> = { productionStatus: input.status, updatedAt: now };
    if (input.status === 'shot') set.shotAt = input.shotDate ? noon(input.shotDate) : now;
    if (input.status === 'waiting' || input.status === 'not_shot') set.shotAt = null;
    await tx.update(s.videos).set(set).where(inArray(s.videos.id, ids));
    for (const row of rows) {
      if (row.productionStatus === input.status) continue;
      await logActivity(
        tx,
        { actorId: actor.id, videoId: row.id, entity: 'video', entityId: row.id, action: 'production.status_changed', before: { status: row.productionStatus }, after: { code: row.code, status: input.status } },
        now,
      );
    }
  });
}

/** „Sdílet se štábem“: a signed 14-day link to the read-only crew page of the cycle. */
export async function createCrewLink(db: Db, actor: Actor, cycleId: string, secret: string, now: Date): Promise<{ token: string }> {
  if (!can(actor, 'production.update')) throw forbidden();
  const [cycle] = await db.select({ id: s.shootingCycles.id }).from(s.shootingCycles).where(eq(s.shootingCycles.id, cycleId));
  if (!cycle) throw new DomainError('NOT_FOUND', 'Cyklus nenalezen.');
  const token = await signCrewLink(cycleId, secret, now);
  await logActivity(db, { actorId: actor.id, videoId: null, entity: 'cycle', entityId: cycleId, action: 'shooting.crew_link', after: { cycleId } }, now);
  return { token };
}

export interface CrewItem {
  id: string;
  code: string;
  title: string;
  hooks: CrewView['hooks'];
  lines: CrewView['lines'];
  props: string;
}
export interface CrewGroup {
  key: string | null;
  label: string;
  castGroups: { label: string; items: CrewItem[] }[];
}
export interface CrewPackage {
  cycleId: string;
  shootDate: string | null;
  groups: CrewGroup[];
}

/** The crew page for a token (null when the link is invalid or expired): 3 queries, no comments or internal meta. */
export async function loadCrewPackage(db: Db, token: string, secret: string, now: Date): Promise<CrewPackage | null> {
  const verified = await verifyCrewLink(token, secret, now);
  if (!verified) return null;
  const [[cycle], videos, lookups] = await Promise.all([
    db.select({ shootDate: s.shootingCycles.shootDate }).from(s.shootingCycles).where(eq(s.shootingCycles.id, verified.cycleId)),
    cycleVideos(db, verified.cycleId),
    allLookups(db),
  ]);
  if (!cycle) return null;
  const shooting = approved(videos);
  const view = new Map(shooting.map((v) => [v.id, v.body ? crewView(v.body) : { hooks: [], lines: [] }]));
  return {
    cycleId: verified.cycleId,
    shootDate: cycle.shootDate,
    groups: groupForShooting(shooting, labelsOf(lookups, 'location')).map((g) => ({
      key: g.key,
      label: g.label,
      castGroups: g.castGroups.map((c) => ({
        label: c.label,
        items: c.items.map((i) => ({ id: i.id, code: i.code, title: i.title, props: i.props, ...view.get(i.id)! })),
      })),
    })),
  };
}

