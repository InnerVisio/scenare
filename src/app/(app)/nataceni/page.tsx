import { Clapperboard } from 'lucide-react';
import { getDb } from '@/db/client';
import { formatDate } from '@/domain/format/date';
import { can } from '@/domain/policy/can';
import { requireActor } from '@/server/auth/session';
import { loadShootingDay } from '@/server/shooting';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { TopBar } from '@/ui/TopBar';
import { ShareWithCrew } from './ShareWithCrew';
import { ShootingList } from './ShootingList';

export const metadata = { title: 'Natáčecí den – GTA Scénáře' };
export const dynamic = 'force-dynamic';

function Countdown({ label, days, date }: { label: string; days: number | null; date: string | null }) {
  const text = days === null ? '—' : days === 0 ? 'Dnes' : days < 0 ? `před ${-days} ${-days === 1 ? 'dnem' : 'dny'}` : String(days);
  return (
    <Card className="flex flex-col gap-1">
      <p className="text-sm font-semibold text-text2">{label}</p>
      <p className="text-h1" data-testid="countdown">
        {text}
      </p>
      {date && <p className="text-sm text-text2">{formatDate(new Date(`${date}T12:00:00Z`))}</p>}
    </Card>
  );
}

export default async function ShootingDayPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor();
  const raw = (await searchParams).cyklus;
  const day = await loadShootingDay(await getDb(), Array.isArray(raw) ? raw[0] : raw, new Date());
  if (!day) {
    return (
      <div className="flex flex-col gap-4">
        <TopBar title="Natáčecí den" />
        <EmptyState icon={Clapperboard} title="Zatím tu není žádný natáčecí cyklus." />
      </div>
    );
  }
  const { cycle } = day;
  const manage = can(actor, 'production.update');
  return (
    <div className="flex flex-col gap-4">
      <TopBar title="Natáčecí den" subtitle={`Cyklus ${cycle.id.replace('-', '–')} · ${day.approvedCount} schválených scénářů`} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Countdown label="Dní do natáčení" days={cycle.daysToShoot} date={cycle.shootDate} />
        <Countdown label="Dní do termínu schválení" days={cycle.daysToDeadline} date={cycle.approvalDeadline} />
      </div>
      {day.warnings.length > 0 && (
        <ul role="status" className="flex flex-col gap-1 rounded-inner bg-apricot-soft p-4 text-apricot-ink">
          {day.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      <Card className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold">
          Klipů: <span className="text-text2">cíl {cycle.clipTarget}</span>
          {' · '}Scénářů: <span className="text-text2">{day.approvedCount} z {cycle.plannedVideos}</span>
        </p>
        {manage && <ShareWithCrew cycleId={cycle.id} />}
      </Card>
      {day.groups.length === 0 ? (
        <EmptyState icon={Clapperboard} title="V tomhle cyklu zatím nejsou schválené scénáře." description="Po schválení se tu seskupí podle lokace a obsazení." />
      ) : (
        <ShootingList groups={day.groups} formatLabels={day.formatLabels} canMark={manage} defaultDate={cycle.shootDate} />
      )}
    </div>
  );
}
