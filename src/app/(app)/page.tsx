import { getDb } from '@/db/client';
import { requireActor } from '@/server/auth/session';
import { loadEditorOptions } from '@/server/editorOptions';
import { getDashboard } from '@/server/queries';
import { TopBar } from '@/ui/TopBar';
import { ActionCard, CommentsCard, Kanban, PhaseThreeCard, ShootCard } from './_components/dashboard/Dashboard';
import { dateLine, greeting } from './_components/dashboard/model';

export const metadata = { title: 'Přehled – GTA Scénáře' };
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const actor = await requireActor();
  const db = await getDb();
  const now = new Date();
  const [data, options] = await Promise.all([getDashboard(db, actor, now), loadEditorOptions(db)]);
  return (
    <>
      <TopBar title={greeting(now, actor.name)} subtitle={dateLine(now, data.cycle?.daysToShoot ?? null)} size="display" />
      <div className="flex flex-col gap-4 md:gap-6">
        <div className="grid gap-4 md:grid-cols-3 md:gap-6">
          <ActionCard data={data} role={actor.role} />
          <ShootCard cycle={data.cycle} />
          <CommentsCard data={data} />
        </div>
        <PhaseThreeCard />
        <Kanban data={data} categories={options.categories} />
      </div>
    </>
  );
}
