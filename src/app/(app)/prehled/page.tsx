import { redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { requireActor } from '@/server/auth/session';
import { getOverview } from '@/server/overview';
import { currentMonthOf } from '@/server/publications';
import { TopBar } from '@/ui/TopBar';
import { monthLabel, parseMonthParam, isMonthKey } from '@/ui/monthParams';
import { OverviewSections } from './Overview';

export const metadata = { title: 'Čísla – GTA Scénáře' };
export const dynamic = 'force-dynamic';

export default async function OverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if ((await requireActor()).role === 'leadership') redirect('/');
  const params = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const now = new Date();
  const month = parseMonthParam(first(params.mesic), currentMonthOf(now));
  const cyklus = first(params.cyklus);
  const overview = await getOverview(await getDb(), { month, cycleId: isMonthKey(cyklus) ? cyklus : null }, now);
  return (
    <div className="flex flex-col gap-4">
      <TopBar title="Čísla" subtitle={`${monthLabel(month)}${overview.cycleId ? ` · cyklus ${overview.cycleId}` : ''}`} />
      <OverviewSections o={overview} />
    </div>
  );
}
