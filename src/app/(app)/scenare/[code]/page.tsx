import { notFound } from 'next/navigation';
import { getDb } from '@/db/client';
import { requireActor } from '@/server/auth/session';
import { DomainError } from '@/server/errors';
import { loadScriptPage } from '@/server/scripts';
import { ScriptDetail } from './ScriptDetail';

export const metadata = { title: 'Scénář – GTA Scénáře' };
export const dynamic = 'force-dynamic';

export default async function ScriptDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const actor = await requireActor();
  const { code } = await params;
  let data;
  try {
    data = await loadScriptPage(await getDb(), actor, decodeURIComponent(code).toUpperCase(), new Date());
  } catch (error) {
    // A malformed %-escape in the URL (URIError) is just a script that does not exist.
    if (error instanceof URIError || (error instanceof DomainError && error.code === 'NOT_FOUND')) notFound();
    throw error;
  }
  return <ScriptDetail key={data.video.id} data={data} />;
}
