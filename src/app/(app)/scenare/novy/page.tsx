import { redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { can } from '@/domain/policy/can';
import { requireActor } from '@/server/auth/session';
import { loadEditorOptions } from '@/server/editorOptions';
import { ImportForm } from './ImportForm';

export const metadata = { title: 'Nový scénář – GTA Scénáře' };
export const dynamic = 'force-dynamic';

export default async function NewScriptPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor();
  if (!can(actor, 'script.create')) redirect('/scenare');
  const options = await loadEditorOptions(await getDb());
  const query = await searchParams;
  const one = (key: string) => (typeof query[key] === 'string' ? (query[key] as string) : null);
  return <ImportForm options={options} cycleId={one('cyklus')} plannedMonth={one('mesic')} />;
}
