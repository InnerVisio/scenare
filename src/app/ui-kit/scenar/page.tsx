import { notFound } from 'next/navigation';
import { getDb } from '@/db/client';
import { requireActor } from '@/server/auth/session';
import { getVideoDetail, listVideos } from '@/server/queries';
import { buildScriptMeta } from '@/server/scriptMeta';
import type { AnchoredThread } from '../../(app)/_components/script-view/types';
import { ScriptPreview } from './ScriptPreview';

export const metadata = { title: 'Zobrazení scénáře – GTA Scénáře' };
export const dynamic = 'force-dynamic';

/** Preview of ScriptView on the demo script V031; used for screenshots, not linked from the navigation. */
export default async function ScriptViewPreviewPage() {
  const actor = await requireActor();
  const db = await getDb();
  const [item] = await listVideos(db, actor, { q: 'V031' });
  if (!item) notFound();
  const detail = await getVideoDetail(db, actor, item.id);
  if (!detail.currentBody) notFound();

  const { hookTypeLabels, ...meta } = await buildScriptMeta(db, detail);

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
      body={detail.currentBody}
      previousBody={previous}
      meta={meta}
      threads={threads}
      hookTypeLabels={hookTypeLabels}
    />
  );
}
