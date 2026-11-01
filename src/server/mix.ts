import { eq } from 'drizzle-orm';
import type { Db } from '@/db/client';
import * as s from '@/db/schema';
import { buildCycleMix, type CycleMix, type MixItem, type MixVideo } from '@/domain/metrics/mix';
import { DomainError } from './errors';
import { allLookups, type LookupRow } from './editorOptions';

/** Lookups → the items the mix is computed from (non-archived rows with a share; „nevztahuje“ has none and is skipped). */
export function mixItemsFrom(lookups: LookupRow[]) {
  const live = lookups.filter((l) => !l.archived);
  const withShare = (kind: string): MixItem[] =>
    live.flatMap((l) => (l.kind === kind && typeof l.data.share === 'number' ? [{ key: l.key, label: l.label, share: l.data.share }] : []));
  return {
    categories: withShare('category'),
    treatments: withShare('treatment'),
    characters: live
      .filter((l) => l.kind === 'character')
      .map((l) => ({ key: l.key, label: l.label, share: typeof l.data.share === 'number' ? l.data.share : null })),
    profiles: live.filter((l) => l.kind === 'profile').map((l) => ({ key: l.key, label: l.label, personal: l.data.personal === true })),
  };
}

/** Pure: the cycle mix from rows a page has already loaded (no extra queries). */
export function cycleMixFrom(input: { videos: MixVideo[]; lookups: LookupRow[]; plan: number; tolerancePp: number }): CycleMix {
  return buildCycleMix({ videos: input.videos, plan: input.plan, tolerancePp: input.tolerancePp, ...mixItemsFrom(input.lookups) });
}

/** The cycle's mix in 3 parallel queries: the cycle with the tolerance, its videos and the lookups. */
export async function getCycleMix(db: Db, cycleId: string): Promise<CycleMix> {
  const [[cycle], videos, lookups] = await Promise.all([
    db
      .select({ plan: s.shootingCycles.plannedVideos, tolerancePp: s.settings.tolerancePp })
      .from(s.shootingCycles)
      .leftJoin(s.settings, eq(s.settings.id, 'global'))
      .where(eq(s.shootingCycles.id, cycleId)),
    db
      .select({
        approvalStatus: s.videos.approvalStatus,
        categoryKey: s.videos.categoryKey,
        treatmentKey: s.videos.treatmentKey,
        profileKey: s.videos.profileKey,
        characterKey: s.videos.characterKey,
      })
      .from(s.videos)
      .where(eq(s.videos.cycleId, cycleId)),
    allLookups(db),
  ]);
  if (!cycle) throw new DomainError('NOT_FOUND', 'Cyklus nenalezen.');
  return cycleMixFrom({ videos, lookups, plan: cycle.plan, tolerancePp: cycle.tolerancePp ?? 10 });
}
