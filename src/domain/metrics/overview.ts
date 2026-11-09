// The Excel „Přehled“ sections as pure functions (sections 1–5 and 7; section 6 reuses the series metrics). No clock, no I/O.
import { countsTowardsMix, splitTarget, type MixItem } from './mix';

/** The part of a video the overview looks at. `publishedMonth` = Prague month (`YYYY-MM`) of its FIRST publication. */
export interface OverviewVideo {
  cycleId: string | null;
  plannedMonth: string | null;
  categoryKey: string | null;
  treatmentKey: string | null;
  profileKey: string | null;
  characterKey: string | null;
  approvalStatus: string;
  productionStatus: string;
  /** Script due day, `YYYY-MM-DD`. */
  scriptDueDate: string | null;
  /** Approval deadline of the video's cycle (shoot day − N days), `YYYY-MM-DD`. */
  approvalDeadline: string | null;
  publishedMonth: string | null;
  /** Open root comments. */
  openComments: number;
}

const SHOT = new Set(['shot', 'editing', 'edited', 'published']);
export const isShot = (v: Pick<OverviewVideo, 'productionStatus'>) => SHOT.has(v.productionStatus);

export type OverviewStatus = 'none' | 'published' | 'approved' | 'pending' | 'missing';
export const OVERVIEW_STATUS_LABELS: Record<OverviewStatus, string> = {
  none: '–',
  published: 'Publikováno ✔',
  approved: 'Schváleno ✔',
  pending: 'Čeká na schválení',
  missing: 'CHYBÍ SCÉNÁŘE',
};

export type MixDimension = 'category' | 'treatment';
export type MixScope = { kind: 'month'; month: string } | { kind: 'cycle'; cycleId: string };

export interface OverviewMixRow {
  key: string;
  label: string;
  share: number;
  plan: number;
  proposed: number;
  approved: number;
  missing: number;
  shot: number;
  published: number;
  /** published ÷ plan, null without a plan. */
  fulfilment: number | null;
  status: OverviewStatus;
}

const dimensionKey = (v: OverviewVideo, d: MixDimension) => (d === 'category' ? v.categoryKey : v.treatmentKey);

function statusOf(plan: number, proposed: number, approved: number, published: number, withPublication: boolean): OverviewStatus {
  if (plan <= 0) return 'none';
  if (withPublication && published >= plan) return 'published';
  if (approved >= plan) return 'approved';
  if (proposed >= plan) return 'pending';
  return 'missing';
}

function mixRow(
  base: { key: string; label: string; share: number },
  plan: number,
  c: { proposed: number; approved: number; shot: number; published: number },
  withPublication: boolean,
): OverviewMixRow {
  return {
    ...base,
    plan,
    ...c,
    missing: Math.max(0, plan - c.approved),
    fulfilment: plan > 0 ? c.published / plan : null,
    status: statusOf(plan, c.proposed, c.approved, c.published, withPublication),
  };
}

/**
 * Sections 1, 2 (scope = month: planned month filters proposed/approved/shot, the ACTUAL publication month filters published)
 * and 5 (scope = cycle, no publication). `plan` is the month target or the cycle plan, split by shares.
 */
export function buildScopedMix(
  videos: readonly OverviewVideo[],
  items: MixItem[],
  plan: number,
  dimension: MixDimension,
  scope: MixScope,
): { rows: OverviewMixRow[]; total: OverviewMixRow } {
  const targets = splitTarget(plan, items);
  const withPublication = scope.kind === 'month';
  const inScope = (v: OverviewVideo) => (scope.kind === 'month' ? v.plannedMonth === scope.month : v.cycleId === scope.cycleId);
  const rows = items.map((item) => {
    const own = videos.filter((v) => inScope(v) && dimensionKey(v, dimension) === item.key);
    return mixRow(
      item,
      targets[item.key],
      {
        proposed: own.filter((v) => countsTowardsMix(v.approvalStatus)).length,
        approved: own.filter((v) => v.approvalStatus === 'approved').length,
        shot: own.filter(isShot).length,
        published:
          scope.kind === 'month' ? videos.filter((v) => v.publishedMonth === scope.month && dimensionKey(v, dimension) === item.key).length : 0,
      },
      withPublication,
    );
  });
  const sum = (pick: (r: OverviewMixRow) => number) => rows.reduce((n, r) => n + pick(r), 0);
  const total = mixRow(
    { key: 'total', label: 'Celkem', share: items.reduce((n, i) => n + i.share, 0) },
    sum((r) => r.plan),
    { proposed: sum((r) => r.proposed), approved: sum((r) => r.approved), shot: sum((r) => r.shot), published: sum((r) => r.published) },
    withPublication,
  );
  return { rows, total };
}

export interface CharacterRow {
  profileKey: string;
  profileLabel: string;
  characterKey: string;
  characterLabel: string;
  /** Target share 0–1. */
  target: number;
  scripts: number;
  /** Share among this profile's rows, null without any script. */
  scriptShare: number | null;
  prepStatus: 'none' | 'ok' | 'out';
  published: number;
  publishedShare: number | null;
  publicationStatus: 'none' | 'ok' | 'out';
}

function shareStatus(share: number | null, target: number, tolerancePp: number): 'none' | 'ok' | 'out' {
  if (share === null) return 'none';
  return Math.abs(share - target) <= tolerancePp / 100 + 1e-9 ? 'ok' : 'out';
}

/** Section 3: personal vs. work scripts / publications of every personal profile in the month. */
export function buildMonthCharacters(
  videos: readonly OverviewVideo[],
  month: string,
  profiles: { key: string; label: string }[],
  characters: { key: string; label: string; share: number }[],
  tolerancePp: number,
): CharacterRow[] {
  return profiles.flatMap((profile) => {
    const scripts = characters.map(
      (c) => videos.filter((v) => v.plannedMonth === month && countsTowardsMix(v.approvalStatus) && v.profileKey === profile.key && v.characterKey === c.key).length,
    );
    const published = characters.map((c) => videos.filter((v) => v.publishedMonth === month && v.profileKey === profile.key && v.characterKey === c.key).length);
    const scriptSum = scripts.reduce((a, b) => a + b, 0);
    const publishedSum = published.reduce((a, b) => a + b, 0);
    return characters.map((c, i): CharacterRow => {
      const scriptShare = scriptSum === 0 ? null : scripts[i] / scriptSum;
      const publishedShare = publishedSum === 0 ? null : published[i] / publishedSum;
      return {
        profileKey: profile.key,
        profileLabel: profile.label,
        characterKey: c.key,
        characterLabel: c.label,
        target: c.share,
        scripts: scripts[i],
        scriptShare,
        prepStatus: shareStatus(scriptShare, c.share, tolerancePp),
        published: published[i],
        publishedShare,
        publicationStatus: shareStatus(publishedShare, c.share, tolerancePp),
      };
    });
  });
}

export interface CycleCounts {
  total: number;
  awaitingLeadership: number;
  awaitingMarketers: number;
  approved: number;
  approvedWaitingForShoot: number;
  overdueScripts: number;
  unapprovedAfterDeadline: number;
  openComments: number;
  shot: number;
  postponedOrCancelled: number;
}

const OPEN_END = new Set(['approved', 'postponed', 'cancelled']);

function cycleCounts(videos: readonly OverviewVideo[], today: string): CycleCounts {
  const count = (pred: (v: OverviewVideo) => boolean) => videos.filter(pred).length;
  const is = (...statuses: string[]) => (v: OverviewVideo) => statuses.includes(v.approvalStatus);
  return {
    total: count((v) => countsTowardsMix(v.approvalStatus)),
    awaitingLeadership: count(is('in_review', 'final_review')),
    awaitingMarketers: count(is('draft', 'returned')),
    approved: count(is('approved')),
    approvedWaitingForShoot: count((v) => v.approvalStatus === 'approved' && v.productionStatus === 'waiting'),
    overdueScripts: count((v) => v.scriptDueDate !== null && v.scriptDueDate < today && !OPEN_END.has(v.approvalStatus)),
    unapprovedAfterDeadline: count((v) => v.approvalDeadline !== null && v.approvalDeadline < today && !OPEN_END.has(v.approvalStatus)),
    openComments: videos.reduce((n, v) => n + v.openComments, 0),
    shot: count(isShot),
    postponedOrCancelled: count(is('postponed', 'cancelled')),
  };
}

export interface CycleStatus {
  plan: number;
  selected: CycleCounts;
  all: CycleCounts;
  /** max(0, plan − approved) of the selected cycle. */
  missingApproved: number;
}

/** Section 4: the approval state of the selected cycle next to all cycles. `today` = Prague day `YYYY-MM-DD`. */
export function buildCycleStatus(videos: readonly OverviewVideo[], cycleId: string, plan: number, today: string): CycleStatus {
  const selected = cycleCounts(videos.filter((v) => v.cycleId === cycleId), today);
  return { plan, selected, all: cycleCounts(videos, today), missingApproved: Math.max(0, plan - selected.approved) };
}

export interface HistoryRow {
  month: string;
  plan: number;
  scripts: number;
  approved: number;
  published: number;
  fulfilment: number | null;
  byCategory: Record<string, number>;
  byTreatment: Record<string, number>;
}

/** `count` consecutive months starting at `start` (`YYYY-MM`). */
export function monthRange(start: string, count: number): string[] {
  const [year, m] = start.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(year, m - 1 + i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

/** First month of the history: the earliest planned/published month of any video, else `fallback`. */
export function historyStart(videos: readonly OverviewVideo[], fallback: string): string {
  const months = videos.flatMap((v) => [v.plannedMonth, v.publishedMonth].filter((m): m is string => !!m));
  return months.reduce((min, m) => (m < min ? m : min), months[0] ?? fallback);
}

/** Section 7: month by month plan, scripts (planned month), approved, published (actual month) and the published split. */
export function buildHistory(
  videos: readonly OverviewVideo[],
  months: string[],
  monthlyTarget: number,
  categories: { key: string }[],
  treatments: { key: string }[],
): HistoryRow[] {
  return months.map((month) => {
    const planned = videos.filter((v) => v.plannedMonth === month);
    const published = videos.filter((v) => v.publishedMonth === month);
    return {
      month,
      plan: monthlyTarget,
      scripts: planned.filter((v) => countsTowardsMix(v.approvalStatus)).length,
      approved: planned.filter((v) => v.approvalStatus === 'approved').length,
      published: published.length,
      fulfilment: monthlyTarget > 0 ? published.length / monthlyTarget : null,
      byCategory: Object.fromEntries(categories.map((c) => [c.key, published.filter((v) => v.categoryKey === c.key).length])),
      byTreatment: Object.fromEntries(treatments.map((t) => [t.key, published.filter((v) => v.treatmentKey === t.key).length])),
    };
  });
}
