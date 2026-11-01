import { asc, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import * as s from '@/db/schema';
import { cycleLabel } from '@/ui/monthParams';

export interface Option {
  key: string;
  label: string;
}

export interface EditorOptions {
  categories: (Option & { short: string; color: string; textColor: string })[];
  treatments: Option[];
  characters: Option[];
  profiles: (Option & { speaker: string | null; hashtag: string | null })[];
  locations: Option[];
  formats: (Option & { family: string; status: 'verified' | 'untested' })[];
  hookTypes: Option[];
  ctaTypes: (Option & { goalMetric: 'shares' | 'saves' | 'comments' | null })[];
  cycles: Option[];
  series: Option[];
  users: Option[];
}

const str = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
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

/** Shooting cycles and series in one query: `cycle` rows (key = id) first, then `series` rows. */
export async function cyclesAndSeries(db: Db): Promise<{ cycles: Option[]; series: Option[] }> {
  const rows = await db
    .select({ kind: sql<string>`'cycle'`, key: s.shootingCycles.id, label: s.shootingCycles.id, sort: s.shootingCycles.id })
    .from(s.shootingCycles)
    .unionAll(
      db
        .select({
          kind: sql<string>`'series'`,
          key: s.series.id,
          label: sql<string>`${s.series.code} || ' · ' || ${s.series.name}`,
          sort: s.series.code,
        })
        .from(s.series),
    );
  const of = (kind: string) => rows.filter((r) => r.kind === kind).sort((a, b) => a.sort.localeCompare(b.sort));
  return {
    cycles: of('cycle').map((c) => ({ key: c.key, label: cycleLabel(c.key) })),
    series: of('series').map((x) => ({ key: x.key, label: x.label })),
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
    }));
}

/** Pure: the picker options from already loaded rows. */
export function buildEditorOptions(
  allRows: LookupRow[],
  users: Pick<UserRow, 'id' | 'name'>[],
  extra: { cycles: Option[]; series: Option[] },
): EditorOptions {
  const lookups = allRows.filter((l) => !l.archived);
  const of = (kind: string) => lookups.filter((l) => l.kind === kind);
  const plain = (kind: string): Option[] => of(kind).map((l) => ({ key: l.key, label: l.label }));

  return {
    categories: categoryOptions(allRows),
    treatments: plain('treatment'),
    characters: plain('character'),
    profiles: of('profile').map((l) => ({ key: l.key, label: l.label, speaker: orNull(l.data.speaker), hashtag: orNull(l.data.hashtag) })),
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
    users: users.map((u) => ({ key: u.id, label: u.name })).sort((a, b) => a.label.localeCompare(b.label, 'cs')),
  };
}

/** Everything the script editor offers in its pickers: non-archived lookups plus cycles, series and users (3 queries). */
export async function loadEditorOptions(db: Db): Promise<EditorOptions> {
  const [lookups, users, extra] = await Promise.all([allLookups(db), allUsers(db), cyclesAndSeries(db)]);
  return buildEditorOptions(lookups, users, extra);
}
