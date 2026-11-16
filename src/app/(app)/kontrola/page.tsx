import { CheckCheck } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { requireActor } from '@/server/auth/session';
import { getLeadershipScripts } from '@/server/leadershipScripts';
import { getReviewQueue } from '@/server/queries';
import { resolveCycleFilter } from '@/server/review';
import { TopBar } from '@/ui/TopBar';
import { LeadershipScriptsView } from '../scenare/LeadershipScriptsView';

export const metadata = { title: 'Ke kontrole – GTA Scénáře' };
export const dynamic = 'force-dynamic';

export default async function ReviewQueuePage({ searchParams }: { searchParams: Promise<{ cyklus?: string | string[]; zobrazit?: string | string[] }> }) {
  const actor = await requireActor();
  const db = await getDb();
  const cycleId = await resolveCycleFilter(db, (await searchParams).cyklus);
  const now = new Date();
  const [queue, overview] = await Promise.all([getReviewQueue(db, actor, { cycleId }), getLeadershipScripts(db, actor, { all: false }, now)]);

  // Straight to work: the first script the actor has not approved yet.
  const first = queue.find((item) => !item.decidedByActor);
  if (first) redirect(`/kontrola/${first.code}${cycleId ? `?cyklus=${cycleId}` : ''}`);

  const raw = (await searchParams).zobrazit;
  const all = (Array.isArray(raw) ? raw[0] : raw) === 'vse';
  const data = all ? await getLeadershipScripts(db, actor, { all: true }, now) : overview;

  return (
    <div className="flex flex-col gap-4 md:max-w-4xl md:gap-6">
      <TopBar title="Kontrola" />
      <p className="flex items-center gap-2 rounded-card bg-lime-soft p-4 font-semibold text-lime-ink">
        <CheckCheck aria-hidden className="size-5" /> Nic nečeká na tvou kontrolu ✓
      </p>
      <LeadershipScriptsView data={data} basePath="/kontrola" withHeader={false} />
    </div>
  );
}
