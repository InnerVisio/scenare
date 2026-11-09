import { getDb } from '@/db/client';
import { requireActor } from '@/server/auth/session';
import { getDashboard, getLeadershipHome } from '@/server/queries';
import { TopBar } from '@/ui/TopBar';
import { ActionCard, CommentsCard, Kanban, MixCard, ShootCard } from './_components/dashboard/Dashboard';
import { dateLine, greeting } from './_components/dashboard/model';
import { LeadershipHomeView } from './_components/dashboard/LeadershipHome';

export const metadata = { title: 'Přehled – GTA Scénáře' };
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const actor = await requireActor();
  const db = await getDb();
  const now = new Date();
  if (actor.role === 'leadership') {
    return <LeadershipHomeView name={actor.name} now={now} data={await getLeadershipHome(db, actor, now)} />;
  }
  const data = await getDashboard(db, actor, now);
  return (
    <>
      <TopBar title={greeting(now, actor.name)} subtitle={dateLine(now, data.cycle?.daysToShoot ?? null)} size="display" />
      <div className="flex flex-col gap-4 md:gap-6">
        <div className="grid gap-4 md:grid-cols-3 md:gap-6">
          <ActionCard data={data} role={actor.role} />
          <ShootCard cycle={data.cycle} />
          <CommentsCard data={data} />
        </div>
        {data.cycle && data.mix && <MixCard cycleId={data.cycle.id} mix={data.mix} categories={data.categories} />}
        <Kanban data={data} categories={data.categories} />
      </div>
    </>
  );
}
