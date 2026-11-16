import { CheckCheck } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { requireActor } from '@/server/auth/session';
import { getLeadershipHome } from '@/server/leadershipScripts';
import { getReviewQueue } from '@/server/queries';
import { resolveCycleFilter } from '@/server/review';
import { LeadershipHomeView } from '../scenare/LeadershipHomeView';

export const metadata = { title: 'Ke kontrole – GTA Scénáře' };
export const dynamic = 'force-dynamic';

export default async function ReviewQueuePage({ searchParams }: { searchParams: Promise<{ cyklus?: string | string[]; zobrazit?: string | string[]; kategorie?: string | string[] }> }) {
  const actor = await requireActor();
  const db = await getDb();
  const cycleId = await resolveCycleFilter(db, (await searchParams).cyklus);
  const now = new Date();
  const queue = await getReviewQueue(db, actor, { cycleId });

  // Straight to work: the first script the actor has not approved yet.
  const first = queue.find((item) => !item.decidedByActor);
  if (first) redirect(`/kontrola/${first.code}${cycleId ? `?cyklus=${cycleId}` : ''}`);

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const home = await getLeadershipHome(db, actor, { all: one(sp.zobrazit) === 'vse' }, now);

  return (
    <div className="flex flex-col gap-4 md:max-w-4xl md:gap-6">
      <p className="flex items-center gap-2 rounded-card bg-lime-soft p-4 font-semibold text-lime-ink">
        <CheckCheck aria-hidden className="size-5" /> Nic nečeká na tvou kontrolu ✓
      </p>
      <LeadershipHomeView home={home} name={actor.name} openKey={one(sp.kategorie) ?? null} basePath="/kontrola" />
    </div>
  );
}
