import { and, asc, isNotNull, notInArray, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import * as s from '@/db/schema';
import type { MixVideo } from '@/domain/metrics/mix';
import { cycleLabel } from '@/ui/monthParams';

export interface Option {
  key: string;
  label: string;
}

export interface EditorOptions {
  categories: (Option & { short: string; color: string; textColor: string; share: number | null })[];
  treatments: (Option & { share: number | null })[];
  characters: (Option & { share: number | null })[];
  profiles: (Option & { speaker: string | null; hashtag: string | null; personal: boolean })[];
  locations: Option[];
  formats: (Option & { family: string; status: 'verified' | 'untested' })[];
  hookTypes: Option[];
  ctaTypes: (Option & { goalMetric: 'shares' | 'saves' | 'comments' | null })[];
  cycles: Option[];
  series: Option[];
  users: Option[];
  /** Cycle plans and counted scripts, for the mix hints. */
  mix: { plans: Record<string, number>; videos: EditorMixVideo[] };
}

const str = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
const shareOf = (value: unknown): number | null => (typeof value === 'number' ? value : null);
const orNull = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

export type LookupRow = typeof s.lookupItems.$inferSelect;
export type UserRow = typeof s.users.$inferSelect;

/** Every lookup item (archived ones too), in display order. One query serves labels, rules and pickers. */
export function allLookups(db: Db): Promise<LookupRow[]> {
  return db.select().from(s.lookupItems).orderBy(asc(s.lookupItems.sortOrder), asc(s.lookupItems.key));
}

/** All users by name. */
export function allUsers(db: Db): Promise<UserRow[]> {
  return db.select().from(s.users).orderBy(asc(s.users.name));
}

/** Scripts of cycles that count towards the mix (the editor's hints work from these). */
export type EditorMixVideo = MixVideo & { cycleId: string };

export interface CyclesAndSeries {
  cycles: Option[];
  series: Option[];
  /** Planned videos per cycle id. */
  plans: Record<string, number>;
  mixVideos: EditorMixVideo[];
}

/**
 * Shooting cycles, series and the cycles' counted scripts in one query (a union keeps the editor within the
 * page query ceiling). `cycle` rows: key = id, n = planned videos; `series` rows: key = id; `video` rows:
 * key = cycle id, label = category, a = treatment, b = profile, c = character, d = approval status.
 */
export async function cyclesAndSeries(db: Db): Promise<CyclesAndSeries> {
  const text = sql<string | null>`null::text`;
  const rows = await db
    .select({
      kind: sql<string>`'cycle'`,
      key: s.shootingCycles.id,
      label: sql<string | null>`${s.shootingCycles.id}`,
      sort: s.shootingCycles.id,
      a: text,
      b: text,
      c: text,
      d: text,
      n: sql<number | null>`${s.shootingCycles.plannedVideos}`,
    })
    .from(s.shootingCycles)
    .unionAll(
      db
        .select({
          kind: sql<string>`'series'`,
          key: s.series.id,
          label: sql<string | null>`${s.series.code} || ' · ' || ${s.series.name}`,
          sort: s.series.code,
          a: text,
          b: text,
          c: text,
          d: text,
          n: sql<number | null>`null::int`,
        })
        .from(s.series),
    )
    .unionAll(
      db
        .select({
          kind: sql<string>`'video'`,
          key: sql<string>`${s.videos.cycleId}`,
          label: sql<string | null>`${s.videos.categoryKey}`,
          sort: s.videos.code,
          a: sql<string | null>`${s.videos.treatmentKey}`,
          b: sql<string | null>`${s.videos.profileKey}`,
          c: sql<string | null>`${s.videos.characterKey}`,
          d: sql<string | null>`${s.videos.approvalStatus}`,
          n: sql<number | null>`null::int`,
        })
        .from(s.videos)
        .where(and(isNotNull(s.videos.cycleId), notInArray(s.videos.approvalStatus, ['postponed', 'cancelled']))),
    );
  const of = (kind: string) => rows.filter((r) => r.kind === kind).sort((a, b) => a.sort.localeCompare(b.sort));
  return {
    cycles: of('cycle').map((c) => ({ key: c.key, label: cycleLabel(c.key) })),
    series: of('series').map((x) => ({ key: x.key, label: x.label ?? '' })),
    plans: Object.fromEntries(of('cycle').map((c) => [c.key, c.n ?? 0])),
    mixVideos: of('video').map((v) => ({
      cycleId: v.key,
      categoryKey: v.label,
      treatmentKey: v.a,
      profileKey: v.b,
      characterKey: v.c,
      approvalStatus: v.d ?? 'draft',
    })),
  };
}

export function categoryOptions(lookups: LookupRow[]): EditorOptions['categories'] {
  return lookups
    .filter((l) => l.kind === 'category' && !l.archived)
    .map((l) => ({
      key: l.key,
      label: l.label,
      short: str(l.data.short, l.label),
      color: str(l.data.color, '#F4F3FA'),
      textColor: str(l.data.textColor, '#17151F'),
      share: shareOf(l.data.share),
    }));
}

/** Pure: the picker options from already loaded rows. */
export function buildEditorOptions(
  allRows: LookupRow[],
  users: Pick<UserRow, 'id' | 'name'>[],
  extra: CyclesAndSeries,
): EditorOptions {
  const lookups = allRows.filter((l) => !l.archived);
  const of = (kind: string) => lookups.filter((l) => l.kind === kind);
  const plain = (kind: string): Option[] => of(kind).map((l) => ({ key: l.key, label: l.label }));

  return {
    categories: categoryOptions(allRows),
    treatments: of('treatment').map((l) => ({ key: l.key, label: l.label, share: shareOf(l.data.share) })),
    characters: of('character').map((l) => ({ key: l.key, label: l.label, share: shareOf(l.data.share) })),
    profiles: of('profile').map((l) => ({ key: l.key, label: l.label, speaker: orNull(l.data.speaker), hashtag: orNull(l.data.hashtag), personal: l.data.personal === true })),
    locations: plain('location'),
    formats: of('format').map((l) => ({
      key: l.key,
      label: l.label,
      family: str(l.data.family),
      status: l.data.status === 'verified' ? 'verified' : 'untested',
    })),
    hookTypes: plain('hook_type'),
    ctaTypes: of('cta_type').map((l) => ({
      key: l.key,
      label: l.label,
      goalMetric: l.data.goalMetric === 'shares' || l.data.goalMetric === 'saves' || l.data.goalMetric === 'comments' ? l.data.goalMetric : null,
    })),
    cycles: extra.cycles,
    series: extra.series,
    mix: { plans: extra.plans, videos: extra.mixVideos },
    users: users.map((u) => ({ key: u.id, label: u.name })).sort((a, b) => a.label.localeCompare(b.label, 'cs')),
  };
}

/** Everything the script editor offers in its pickers: non-archived lookups plus cycles, series and users (3 queries). */
export async function loadEditorOptions(db: Db): Promise<EditorOptions> {
  const [lookups, users, extra] = await Promise.all([allLookups(db), allUsers(db), cyclesAndSeries(db)]);
  return buildEditorOptions(lookups, users, extra);
}
