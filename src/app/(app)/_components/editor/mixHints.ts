import { buildCycleMix, mixHint, type CycleMix, type MixRow } from '@/domain/metrics/mix';
import type { EditorOptions } from '@/server/editorOptions';
import type { EditorValues } from '@/server/scripts';

const percent = (value: number) => `${Math.round(value * 100)} %`;

export interface MixHints {
  category: string | null;
  treatment: string | null;
  character: string | null;
  /** „(chybí N)“ per option key. */
  categoryMissing: Record<string, number>;
  treatmentMissing: Record<string, number>;
}

function mixOf(options: EditorOptions, cycleId: string): CycleMix {
  const withShare = (items: { key: string; label: string; share: number | null }[]) =>
    items.flatMap((i) => (i.share === null ? [] : [{ key: i.key, label: i.label, share: i.share }]));
  return buildCycleMix({
    videos: options.mix.videos.filter((v) => v.cycleId === cycleId),
    plan: options.mix.plans[cycleId] ?? 0,
    tolerancePp: 10,
    categories: withShare(options.categories.map((c) => ({ ...c, label: c.short }))),
    treatments: withShare(options.treatments),
    characters: options.characters,
    profiles: options.profiles,
  });
}

const missingOf = (rows: MixRow[]) => Object.fromEntries(rows.filter((r) => r.missing > 0).map((r) => [r.key, r.missing]));

/** What the cycle still needs, for the hints under category, treatment and character (works from the saved scripts). */
export function mixHints(options: EditorOptions, values: Pick<EditorValues, 'cycleId' | 'categoryKey' | 'treatmentKey' | 'profileKey' | 'characterKey'>): MixHints {
  const none: MixHints = { category: null, treatment: null, character: null, categoryMissing: {}, treatmentMissing: {} };
  if (!values.cycleId) return none;
  const mix = mixOf(options, values.cycleId);
  const hintFor = (rows: MixRow[], key: string | null) => {
    const row = rows.find((r) => r.key === key);
    return row ? mixHint(row) : null;
  };
  const personal = mix.characters.find((c) => c.profileKey === values.profileKey);
  let character: string | null = null;
  if (personal) {
    const part = personal.characters.find((c) => c.key === values.characterKey) ?? [...personal.characters].sort((a, b) => b.target - a.target)[0];
    if (part) character = `${personal.label}: ${part.label.toLowerCase()} ${part.share === null ? 'zatím žádný scénář' : percent(part.share)} · cíl ${percent(part.target)}`;
  }
  return {
    category: hintFor(mix.categories.rows, values.categoryKey),
    treatment: hintFor(mix.treatments.rows, values.treatmentKey),
    character,
    categoryMissing: missingOf(mix.categories.rows),
    treatmentMissing: missingOf(mix.treatments.rows),
  };
}
