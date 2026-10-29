import { notFound, redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { requireActor } from '@/server/auth/session';
import { loadEditorOptions } from '@/server/editorOptions';
import { DomainError } from '@/server/errors';
import { loadScriptPage } from '@/server/scripts';
import { ScriptEditor } from '../../../_components/editor/ScriptEditor';
import { ScriptDetail } from '../ScriptDetail';

export const metadata = { title: 'Úprava scénáře – GTA Scénáře' };
export const dynamic = 'force-dynamic';

export default async function EditScriptPage({ params }: { params: Promise<{ code: string }> }) {
  const actor = await requireActor();
  const db = await getDb();
  const { code } = await params;

  let data;
  try {
    data = await loadScriptPage(db, actor, decodeURIComponent(code).toUpperCase(), new Date());
  } catch (error) {
    if (error instanceof URIError || (error instanceof DomainError && error.code === 'NOT_FOUND')) notFound();
    throw error;
  }

  if (data.actions.edit) {
    return <ScriptEditor key={data.video.id} data={data} options={await loadEditorOptions(db)} />;
  }
  // An approved script is locked: show it read-only with the button that unlocks it for the author.
  if (data.actions.unlock) {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="rounded-card bg-apricot-soft px-5 py-4 text-apricot-ink">
          <b>Schválený scénář je zamčený.</b> Odemkni ho, abys ho mohl upravit. Po úpravě půjde znovu ke kontrole.
        </p>
        <ScriptDetail key={data.video.id} data={data} />
      </div>
    );
  }
  redirect(`/scenare/${data.video.code}`);
}
