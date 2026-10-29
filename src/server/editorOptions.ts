import { asc, eq } from 'drizzle-orm';
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

/** Everything the script editor offers in its pickers: non-archived lookups plus cycles, series and users. */
export async function loadEditorOptions(db: Db): Promise<EditorOptions> {
  const [lookups, cycles, series, users] = await Promise.all([
    db
      .select()
      .from(s.lookupItems)
      .where(eq(s.lookupItems.archived, false))
      .orderBy(asc(s.lookupItems.sortOrder), asc(s.lookupItems.key)),
    db.select({ id: s.shootingCycles.id }).from(s.shootingCycles).orderBy(asc(s.shootingCycles.id)),
    db.select().from(s.series).orderBy(asc(s.series.code)),
    db.select({ id: s.users.id, name: s.users.name }).from(s.users),
  ]);
  const of = (kind: string) => lookups.filter((l) => l.kind === kind);
  const plain = (kind: string): Option[] => of(kind).map((l) => ({ key: l.key, label: l.label }));

  return {
    categories: of('category').map((l) => ({
      key: l.key,
      label: l.label,
      short: str(l.data.short, l.label),
      color: str(l.data.color, '#F4F3FA'),
      textColor: str(l.data.textColor, '#17151F'),
    })),
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
    cycles: cycles.map((c) => ({ key: c.id, label: cycleLabel(c.id) })),
    series: series.map((x) => ({ key: x.id, label: `${x.code} · ${x.name}` })),
    users: users.map((u) => ({ key: u.id, label: u.name })).sort((a, b) => a.label.localeCompare(b.label, 'cs')),
  };
}
