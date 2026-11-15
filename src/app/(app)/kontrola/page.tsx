import { CheckCheck } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { requireActor } from '@/server/auth/session';
import { weekdayLongDate, daysWord } from '@/domain/format/date';
import { getLeadershipScripts } from '@/server/leadershipScripts';
import { getReviewQueue } from '@/server/queries';
import { resolveCycleFilter } from '@/server/review';
import { ButtonLink } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { TopBar } from '@/ui/TopBar';

export const metadata = { title: 'Ke kontrole – GTA Scénáře' };
export const dynamic = 'force-dynamic';

export default async function ReviewQueuePage({ searchParams }: { searchParams: Promise<{ cyklus?: string | string[] }> }) {
  const actor = await requireActor();
  const db = await getDb();
  const cycleId = await resolveCycleFilter(db, (await searchParams).cyklus);
  const now = new Date();
  const [queue, overview] = await Promise.all([getReviewQueue(db, actor, { cycleId }), getLeadershipScripts(db, actor, { all: false }, now)]);
  const next = overview.sections[0];

  // Straight to work: the first script the actor has not approved yet.
  const first = queue.find((item) => !item.decidedByActor);
  if (first) redirect(`/kontrola/${first.code}${cycleId ? `?cyklus=${cycleId}` : ''}`);

  return (
    <>
      <TopBar title="Kontrola" />
      <EmptyState
        icon={CheckCheck}
        title="Všechno máš zkontrolované 🎉"
        description={
          next?.shootDate && next.daysToShoot !== null
            ? `Další natáčení: ${weekdayLongDate(next.shootDate)}${next.daysToShoot > 0 ? ` (za ${daysWord(next.daysToShoot)})` : next.daysToShoot === 0 ? ' (dnes)' : ''} · schváleno ${next.approvedCount} ze ${next.totalCount}`
            : queue.length > 0
              ? 'Zbývá počkat na ostatní, ty tvoje schválené scénáře ještě čekají na druhý podpis.'
              : 'Žádný scénář teď nečeká na kontrolu.'
        }
        action={<ButtonLink href="/scenare" variant="primary">Prohlédnout scénáře →</ButtonLink>}
      />
    </>
  );
}
