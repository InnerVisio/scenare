import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { getDb } from '@/db/client';
import * as s from '@/db/schema';
import { durationSec } from '@/domain/script/metrics';
import { requireActor } from '@/server/auth/session';
import { getVideoDetail, listVideos } from '@/server/queries';
import type { AnchoredThread, ScriptMeta } from '../../(app)/_components/script-view/types';
import { ScriptPreview } from './ScriptPreview';

export const metadata = { title: 'Zobrazení scénáře – GTA Scénáře' };
export const dynamic = 'force-dynamic';

const GOAL_LABELS = { shares: 'Sdílení', saves: 'Uložení', comments: 'Komentáře' } as const;

/** Preview of ScriptView on the demo script V031; used for screenshots, not linked from the navigation. */
export default async function ScriptViewPreviewPage() {
  const actor = await requireActor();
  const db = await getDb();
  const [item] = await listVideos(db, actor, { q: 'V031' });
  if (!item) notFound();
  const detail = await getVideoDetail(db, actor, item.id);
  if (!detail.currentBody) notFound();
  const { video, currentBody: body } = detail;

  const lookups = await db.select().from(s.lookupItems);
  const lookup = (kind: string, key: string | null | undefined) =>
    key ? lookups.find((l) => l.kind === kind && l.key === key) : undefined;

  const category = lookup('category', video.categoryKey);
  const format = lookup('format', video.formatKey);
  const profile = lookup('profile', video.profileKey);
  const character = lookup('character', video.characterKey);
  const ctaType = body.cta ? lookup('cta_type', body.cta.ctaType) : undefined;
  const [series] = video.seriesId ? await db.select().from(s.series).where(eq(s.series.id, video.seriesId)) : [];

  const meta: ScriptMeta = {
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
    durationSec: durationSec(body),
    goalLabel: video.goalMetric ? GOAL_LABELS[video.goalMetric] : undefined,
    profileLabel: profile ? `${profile.label}${character ? ` · ${character.label.toLocaleLowerCase('cs')}` : ''}` : undefined,
    locationLabels: video.locationKeys.map((key) => lookup('location', key)?.label ?? key),
    ctaLabel: ctaType ? ctaType.label.charAt(0).toLocaleLowerCase('cs') + ctaType.label.slice(1) : undefined,
  };

  const hookTypeLabels = Object.fromEntries(lookups.filter((l) => l.kind === 'hook_type').map((l) => [l.key, l.label]));

  const threads: AnchoredThread[] = detail.threads.map((t) => ({
    id: t.id,
    index: t.index,
    anchor: t.anchor,
    suggestion: t.suggestion ? { replacement: t.suggestion.replacement, state: t.suggestion.state } : null,
    status: t.status,
    isDetached: t.isDetached,
  }));

  const previous = detail.versions.length > 1 ? detail.versions.at(-2)?.body : undefined;

  return (
    <ScriptPreview
      body={body}
      previousBody={previous}
      meta={meta}
      threads={threads}
      hookTypeLabels={hookTypeLabels}
    />
  );
}
