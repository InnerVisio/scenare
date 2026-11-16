import { cycleLabel } from '@/domain/format/date';
import { getDb } from '@/db/client';
import { requireActor } from '@/server/auth/session';
import { getLeadershipHome } from '@/server/leadershipScripts';
import { getDashboard } from '@/server/queries';
import { TopBar } from '@/ui/TopBar';
import { ActionCard, CommentsCard, Kanban, MixCard, ShootCard } from './_components/dashboard/Dashboard';
import { LeadershipHomeView } from './scenare/LeadershipHomeView';
import { dateLine, greeting } from './_components/dashboard/model';

export const metadata = { title: 'Přehled – GTA Scénáře' };
export const dynamic = 'force-dynamic';

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor();
  const db = await getDb();
  const now = new Date();
  if (actor.role === 'leadership') {
    const sp = await searchParams;
    const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
    const home = await getLeadershipHome(db, actor, { all: one(sp.zobrazit) === 'vse' }, now);
    return <LeadershipHomeView home={home} name={actor.name} openKey={one(sp.kategorie) ?? null} />;
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
        {data.cycle && data.mix && <MixCard cycleId={data.cycle.id} cycleTitle={cycleLabel(data.cycle)} mix={data.mix} categories={data.categories} />}
        <Kanban data={data} categories={data.categories} />
      </div>
    </>
  );
}
