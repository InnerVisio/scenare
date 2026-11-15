import Link from 'next/link';
import { dayMonthOf, daysWord, weekdayLongDate } from '@/domain/format/date';
import type { LeadershipGroup, LeadershipStatus } from '@/domain/workflow/leadershipStatus';
import type { LeadershipScriptItem, LeadershipScripts, LeadershipSection } from '@/server/leadershipScripts';
import { ButtonLink } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { CategoryTag } from '@/ui/CategoryTag';
import { TopBar } from '@/ui/TopBar';
import { cn, focusRing } from '@/ui/cn';
import { StatusLegend } from '../_components/review/LeadershipHelp';

const TONES: Record<LeadershipStatus['tone'], string> = {
  apricot: 'bg-apricot-soft text-apricot-ink',
  lavender: 'bg-violet-soft text-violet-ink',
  lime: 'bg-lime-soft text-lime-ink',
  text2: 'bg-grey-soft text-text2',
  muted: 'bg-grey-soft text-text2 opacity-70',
};

function StatusChip({ status }: { status: LeadershipStatus }) {
  return (
    <span className={cn('inline-flex w-fit items-center rounded-pill px-3 py-1 text-sm font-semibold', TONES[status.tone])}>
      {status.label}
      {status.sub ? <span className="ml-1 font-normal">· {status.sub}</span> : null}
    </span>
  );
}

function ScriptCard({ item, data }: { item: LeadershipScriptItem; data: LeadershipScripts }) {
  const category = data.categories.find((c) => c.key === item.categoryKey);
  const mine = item.status.group === 'me';
  return (
    <li className={cn(item.status.group === 'muted' && 'opacity-60')}>
      <Link
        href={mine ? `/kontrola/${item.code}` : `/scenare/${item.code}`}
        className={cn('flex flex-col gap-2 rounded-card bg-card p-4 md:p-5', focusRing)}
      >
        <span className="font-semibold">{item.title}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text2">
          <span>{item.code}</span>
          {category && <CategoryTag categoryKey={category.key} label={category.label} short={category.short} colors={category} />}
          {item.cast && <span>· {item.cast}</span>}
        </span>
        <span className="flex flex-wrap items-center justify-between gap-2">
          <StatusChip status={item.status} />
          {mine && <span className="inline-flex min-h-12 items-center rounded-pill bg-ink px-5 font-semibold text-card">Zkontrolovat →</span>}
        </span>
      </Link>
    </li>
  );
}

const GROUPS: { key: LeadershipGroup[]; title: string; showSub?: boolean }[] = [
  { key: ['me'], title: 'Čeká na tebe' },
  { key: ['other'], title: 'Čeká na druhého' },
  { key: ['approved'], title: 'Schváleno – točíme ✓' },
  { key: ['admin'], title: 'U Admina' },
];

function Groups({ groups, data, withMuted }: { groups: LeadershipSection['groups']; data: LeadershipScripts; withMuted?: boolean }) {
  const parts = [...GROUPS, ...(withMuted ? [{ key: ['muted'] as LeadershipGroup[], title: 'Odloženo a zrušeno' }] : [])];
  return (
    <>
      {parts.map((g) => {
        const items = g.key.flatMap((k) => groups[k]);
        if (items.length === 0) return null;
        return (
          <section key={g.title} aria-label={g.title} className="flex flex-col gap-2">
            <h3 className="text-h2">
              {g.title} <span className="text-text2">· {items.length}</span>
            </h3>
            <ul className="grid gap-2 md:grid-cols-2">
              {items.map((item) => (
                <ScriptCard key={item.id} item={item} data={data} />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

const when = (n: number | null) => (n === null ? '' : n > 0 ? ` · za ${daysWord(n)}` : n === 0 ? ' · dnes' : ' · už proběhlo');

function CycleHeader({ c }: { c: LeadershipSection }) {
  const pct = c.totalCount > 0 ? Math.round((c.approvedCount / c.totalCount) * 100) : 0;
  const overdue = c.daysToDeadline !== null && c.daysToDeadline < 0;
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-h1">{c.shootDate ? `Natáčení ${weekdayLongDate(c.shootDate)}${when(c.daysToShoot)}` : c.label}</h2>
      <div>
        <p className="mb-1 font-semibold">
          Schváleno {c.approvedCount} ze {c.totalCount}
        </p>
        <div role="progressbar" aria-valuemin={0} aria-valuemax={c.totalCount} aria-valuenow={c.approvedCount} className="h-2.5 overflow-hidden rounded-full bg-ink/10">
          <div className="h-full rounded-full bg-lime-dot" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {c.approvalDeadline && (
        <p className="text-text2">
          Termín schválení: {dayMonthOf(c.approvalDeadline)}
          {overdue && <span className="ml-2 font-semibold text-danger-text">po termínu</span>}
        </p>
      )}
      <Link href={`/nataceni?cyklus=${c.id}`} className={cn('inline-flex min-h-12 items-center text-sm font-semibold text-violet underline', focusRing)}>
        Plán natáčení (kde a kdo) →
      </Link>
    </Card>
  );
}

function CycleSection({ c, data }: { c: LeadershipSection; data: LeadershipScripts }) {
  return (
    <section aria-label={c.label} className="flex flex-col gap-4">
      <CycleHeader c={c} />
      <Groups groups={c.groups} data={data} withMuted />
    </section>
  );
}

export function LeadershipScriptsView({ data }: { data: LeadershipScripts }) {
  const upcoming = data.sections.filter((c) => c.kind !== 'past');
  const past = data.sections.filter((c) => c.kind === 'past');
  const tab = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn('flex min-h-12 flex-1 items-center justify-center rounded-pill px-4 font-semibold', focusRing, active ? 'bg-ink text-card' : 'text-ink')}
    >
      {label}
    </Link>
  );
  return (
    <div className="flex flex-col gap-4 md:max-w-4xl md:gap-6">
      <TopBar title="Scénáře" hidePeriod />
      <nav aria-label="Zobrazení" className="flex gap-1 rounded-pill bg-ink/[0.06] p-1">
        {tab('/scenare', 'Příští natáčení', !data.all)}
        {tab('/scenare?zobrazit=vse', 'Všechny', data.all)}
      </nav>
      {data.sections.length === 0 && <Card>Zatím tu nejsou žádná natáčení.</Card>}
      {upcoming.map((c) => (
        <CycleSection key={c.id} c={c} data={data} />
      ))}
      {data.all && data.unscheduledCount > 0 && (
        <section aria-label="Bez termínu natáčení" className="flex flex-col gap-4">
          <h2 className="text-h1">Bez termínu natáčení</h2>
          <Groups groups={data.unscheduled} data={data} withMuted />
        </section>
      )}
      {past.length > 0 && (
        <details className="rounded-card bg-card p-4">
          <summary className={cn('min-h-12 cursor-pointer text-h2', focusRing)}>Starší natáčení · {past.length}</summary>
          <div className="mt-4 flex flex-col gap-6">
            {past.map((c) => (
              <CycleSection key={c.id} c={c} data={data} />
            ))}
          </div>
        </details>
      )}
      <details className="rounded-card bg-card p-4">
        <summary className={cn('min-h-12 cursor-pointer font-semibold', focusRing)}>Co znamenají stavy?</summary>
        <StatusLegend className="mt-3" />
      </details>
      {!data.all && data.sections.length > 0 && (
        <ButtonLink href="/scenare?zobrazit=vse" variant="outline" className="w-fit">
          Zobrazit všechna natáčení
        </ButtonLink>
      )}
    </div>
  );
}
