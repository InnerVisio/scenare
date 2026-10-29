import { eq } from 'drizzle-orm';
import type { Db } from '@/db/client';
import * as s from '@/db/schema';
import { durationSec } from '@/domain/script/metrics';
import type { ScriptMeta } from '@/app/(app)/_components/script-view/types';
import type { VideoDetail } from './queries';

export const GOAL_LABELS = { shares: 'Sdílení', saves: 'Uložení', comments: 'Komentáře' } as const;

const lowerFirst = (value: string) => value.charAt(0).toLocaleLowerCase('cs') + value.slice(1);

/** Everything `ScriptView` shows around the script text: lookup labels, goal, profile, locations, series. */
export async function buildScriptMeta(
  db: Db,
  detail: VideoDetail,
): Promise<ScriptMeta & { hookTypeLabels: Record<string, string> }> {
  const { video, currentBody: body } = detail;
  const lookups = await db.select().from(s.lookupItems);
  const lookup = (kind: string, key: string | null | undefined) =>
    key ? lookups.find((l) => l.kind === kind && l.key === key) : undefined;

  const category = lookup('category', video.categoryKey);
  const format = lookup('format', video.formatKey);
  const profile = lookup('profile', video.profileKey);
  const character = lookup('character', video.characterKey);
  const ctaType = body?.cta ? lookup('cta_type', body.cta.ctaType) : undefined;
  const [series] = video.seriesId ? await db.select().from(s.series).where(eq(s.series.id, video.seriesId)) : [];

  return {
    code: video.code,
    versionNo: detail.latestVersion?.versionNo ?? 1,
    title: video.title,
    seriesLabel: series ? `Série ${series.code}${video.episodeNo ? ` · díl ${video.episodeNo}` : ''}` : undefined,
    categoryTag: {
      key: video.categoryKey ?? '',
      label: category?.label ?? 'Bez kategorie',
      colors: {
        color: String(category?.data.color ?? '#F4F3FA'),
        textColor: String(category?.data.textColor ?? '#17151F'),
      },
    },
    formatLabel: format ? `${String(format.data.family ?? '')} · ${format.label}` : undefined,
    isTrialReel: video.isTrialReel,
    durationSec: body ? durationSec(body) : null,
    goalLabel: video.goalMetric ? GOAL_LABELS[video.goalMetric] : undefined,
    profileLabel: profile ? `${profile.label}${character ? ` · ${lowerFirst(character.label)}` : ''}` : undefined,
    locationLabels: video.locationKeys.map((key) => lookup('location', key)?.label ?? key),
    ctaLabel: ctaType ? lowerFirst(ctaType.label) : undefined,
    hookTypeLabels: Object.fromEntries(lookups.filter((l) => l.kind === 'hook_type').map((l) => [l.key, l.label])),
  };
}
