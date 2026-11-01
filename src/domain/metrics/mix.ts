// Thematic mix of a shooting cycle, computed the way the Excel „Přehled“ does. Pure: no clock, no I/O.

export interface MixItem {
  key: string;
  label: string;
  /** 0–1 */
  share: number;
}

/** The part of a video the mix looks at. */
export interface MixVideo {
  approvalStatus: string;
  categoryKey: string | null;
  treatmentKey: string | null;
  profileKey: string | null;
  characterKey: string | null;
}

export type MixStatus = 'none' | 'approved' | 'pending' | 'missing';

export const MIX_STATUS_LABELS: Record<MixStatus, string> = {
  none: '—',
  approved: 'Schváleno ✔',
  pending: 'Čeká na schválení',
  missing: 'Chybí scénáře',
};

export interface MixRow {
  key: string;
  label: string;
  share: number;
  plan: number;
  proposed: number;
  approved: number;
  missing: number;
  status: MixStatus;
}

export interface Mix {
  rows: MixRow[];
  total: MixRow;
  /** Counted scripts with no (or an unknown) value in this dimension. */
  unassigned: number;
}

/** Postponed and cancelled scripts do not count towards the mix. */
export function countsTowardsMix(approvalStatus: string): boolean {
  return approvalStatus !== 'postponed' && approvalStatus !== 'cancelled';
}

/** Round half away from zero (the spreadsheet's ROUND). */
function roundHalfAway(value: number): number {
  const rounded = Math.round(Math.abs(value) + 1e-9);
  return value < 0 ? -rounded : rounded;
}

/**
 * Split `total` by shares: each item gets `round(total * share)`, the difference to `total` goes to the item
 * with the largest share (the first one on a tie).
 */
export function splitTarget(total: number, items: { key: string; share: number }[]): Record<string, number> {
  const result: Record<string, number> = {};
  let sum = 0;
  let biggest: { key: string; share: number } | null = null;
  for (const item of items) {
    result[item.key] = roundHalfAway(total * item.share);
    sum += result[item.key];
    if (!biggest || item.share > biggest.share) biggest = item;
  }
  if (biggest) result[biggest.key] += total - sum;
  return result;
}

function statusOf(plan: number, proposed: number, approved: number): MixStatus {
  if (plan <= 0) return 'none';
  if (approved >= plan) return 'approved';
  if (proposed >= plan) return 'pending';
  return 'missing';
}

function row(base: Pick<MixRow, 'key' | 'label' | 'share'>, plan: number, proposed: number, approved: number): MixRow {
  return { ...base, plan, proposed, approved, missing: Math.max(0, plan - approved), status: statusOf(plan, proposed, approved) };
}

/** One dimension (category or treatment) of the cycle: plan, proposed, approved and what is missing per item. */
export function buildMix<V extends { approvalStatus: string }>(
  videos: V[],
  items: MixItem[],
  plan: number,
  keyOf: (video: V) => string | null,
): Mix {
  const targets = splitTarget(plan, items);
  const counted = videos.filter((v) => countsTowardsMix(v.approvalStatus));
  const known = new Set(items.map((i) => i.key));
  const rows = items.map((item) => {
    const own = counted.filter((v) => keyOf(v) === item.key);
    return row(item, targets[item.key], own.length, own.filter((v) => v.approvalStatus === 'approved').length);
  });
  const total = row(
    { key: 'total', label: 'Celkem', share: items.reduce((sum, i) => sum + i.share, 0) },
    rows.reduce((sum, r) => sum + r.plan, 0),
    rows.reduce((sum, r) => sum + r.proposed, 0),
    rows.reduce((sum, r) => sum + r.approved, 0),
  );
  const unassigned = counted.filter((v) => {
    const key = keyOf(v);
    return key === null || !known.has(key);
  }).length;
  return { rows, total, unassigned };
}

export interface CharacterShare {
  key: string;
  label: string;
  count: number;
  /** 0–1, null without any script. */
  share: number | null;
  /** Target share 0–1. */
  target: number;
}

export interface CharacterMixRow {
  profileKey: string;
  label: string;
  total: number;
  characters: CharacterShare[];
  status: 'none' | 'ok' | 'out';
}

/** Personal vs. work scripts of every personal profile (Honza, Radek), compared with the target within ±tolerance. */
export function buildCharacterMix(
  videos: MixVideo[],
  profiles: { key: string; label: string; personal: boolean }[],
  characters: { key: string; label: string; share: number | null }[],
  tolerancePp: number,
): CharacterMixRow[] {
  const targets = characters.filter((c): c is { key: string; label: string; share: number } => c.share !== null);
  return profiles
    .filter((p) => p.personal)
    .map((profile) => {
      const own = videos.filter((v) => v.profileKey === profile.key && countsTowardsMix(v.approvalStatus));
      const counted = own.filter((v) => targets.some((t) => t.key === v.characterKey));
      const shares: CharacterShare[] = targets.map((t) => {
        const count = counted.filter((v) => v.characterKey === t.key).length;
        return { key: t.key, label: t.label, count, share: counted.length > 0 ? count / counted.length : null, target: t.share };
      });
      const within = shares.every((c) => c.share !== null && Math.abs(c.share - c.target) <= tolerancePp / 100 + 1e-9);
      return {
        profileKey: profile.key,
        label: profile.label,
        total: counted.length,
        characters: shares,
        status: counted.length === 0 ? ('none' as const) : within ? ('ok' as const) : ('out' as const),
      };
    });
}

/** „Trendy: 1 / 3 schváleno, chybí 2“ */
export function mixHint(row: Pick<MixRow, 'label' | 'plan' | 'approved' | 'missing'>): string {
  return `${row.label}: ${row.approved} / ${row.plan} schváleno, chybí ${row.missing}`;
}

export interface CycleMix {
  plan: number;
  tolerancePp: number;
  categories: Mix;
  treatments: Mix;
  characters: CharacterMixRow[];
  /** Counted scripts without a category or without a treatment. */
  unassigned: number;
}

/** The whole cycle overview: both dimensions, the personal/work split per profile and the unassigned count. */
export function buildCycleMix(input: {
  videos: MixVideo[];
  plan: number;
  tolerancePp: number;
  categories: MixItem[];
  treatments: MixItem[];
  characters: { key: string; label: string; share: number | null }[];
  profiles: { key: string; label: string; personal: boolean }[];
}): CycleMix {
  const { videos, plan, tolerancePp } = input;
  return {
    plan,
    tolerancePp,
    categories: buildMix(videos, input.categories, plan, (v) => v.categoryKey),
    treatments: buildMix(videos, input.treatments, plan, (v) => v.treatmentKey),
    characters: buildCharacterMix(videos, input.profiles, input.characters, tolerancePp),
    unassigned: videos.filter((v) => countsTowardsMix(v.approvalStatus) && (!v.categoryKey || !v.treatmentKey)).length,
  };
}
