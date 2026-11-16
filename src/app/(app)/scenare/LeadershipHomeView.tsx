import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { weekdayShortDate, daysWord } from '@/domain/format/date';
import type { LeadershipDotColor } from '@/domain/workflow/leadershipStatus';
import type { HomeBox, LeadershipHome } from '@/server/leadershipScripts';
import { TopBar } from '@/ui/TopBar';
import { cn, focusRing } from '@/ui/cn';

export const DOT_CLASS: Record<LeadershipDotColor, string> = {
  yellow: 'bg-[#f2b705]',
  green: 'bg-lime-dot',
  red: 'bg-danger-text',
  grey: 'bg-grey-dot',
};

function Dot({ color, className }: { color: LeadershipDotColor; className?: string }) {
  return <span aria-hidden className={cn('inline-block size-3.5 shrink-0 rounded-full', DOT_CLASS[color], className)} />;
}

const shootLine = (home: LeadershipHome) => {
  if (!home.shootDate) return 'Zatím bez termínu natáčení';
  const n = home.daysToShoot;
  const tail = n === null ? '' : n > 0 ? ` · za ${daysWord(n)}` : n === 0 ? ' · dnes' : ' · už proběhlo';
  return `Natáčení ${weekdayShortDate(home.shootDate)}${tail}`;
};

function BoxCard({ box, open, href }: { box: HomeBox; open: boolean; href: string }) {
  const panel = `box-${box.key || 'none'}`;
  return (
    <li className={cn('overflow-hidden rounded-card bg-card', open && 'md:col-span-2')} data-box={box.key || 'none'}>
      <Link
        href={href}
        scroll={false}
        aria-expanded={open}
        aria-controls={panel}
        style={{ borderLeft: `8px solid ${box.color ?? '#8a87a0'}` }}
        className={cn('flex min-h-24 items-center gap-3 p-4 md:p-5', focusRing)}
      >
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-h2">{box.label}</span>
          <span className="font-semibold">
            {box.done} z {box.total} hotových
          </span>
          {(box.toReview > 0 || box.returned > 0) && (
            <span className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text2">
              {box.toReview > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Dot color="yellow" className="size-2.5" />
                  {box.toReview} ke kontrole
                </span>
              )}
              {box.returned > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Dot color="red" className="size-2.5" />
                  {box.returned} vráceno
                </span>
              )}
            </span>
          )}
        </span>
        <ChevronDown aria-hidden className={cn('size-6 shrink-0 transition-transform', open && 'rotate-180')} />
      </Link>
      {open && (
        <ul id={panel} className="flex flex-col border-t border-ink/10">
          {box.scripts.length === 0 && <li className="p-4 text-text2">Zatím tu nejsou žádné scénáře.</li>}
          {box.scripts.map((s) => (
            <li key={s.id}>
              <Link
                href={s.dot.target === 'review' ? `/kontrola/${s.code}` : `/scenare/${s.code}`}
                className={cn('flex min-h-14 items-center gap-3 px-4 py-3 md:px-5', focusRing)}
              >
                <Dot color={s.dot.color} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">
                    {s.title} <span className="text-xs font-normal text-text2">{s.code}</span>
                  </span>
                  <span className="text-sm text-text2">
                    {s.dot.label}
                    {s.dot.sub ? ` · ${s.dot.sub}` : ''}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function LeadershipHomeView({ home, name, openKey }: { home: LeadershipHome; name: string; openKey: string | null }) {
  const qs = (key: string | null) => {
    const p = new URLSearchParams();
    if (home.all) p.set('zobrazit', 'vse');
    if (key !== null) p.set('kategorie', key || 'none');
    const s = p.toString();
    return s ? `/?${s}` : '/';
  };
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
      <TopBar title={`Ahoj ${name}`} subtitle={shootLine(home)} size="display" hidePeriod />
      <nav aria-label="Zobrazení" className="flex gap-1 rounded-pill bg-ink/[0.06] p-1">
        {tab('/', 'Příští natáčení', !home.all)}
        {tab('/?zobrazit=vse', 'Všechny', home.all)}
      </nav>
      <ul className="grid items-start gap-3 md:grid-cols-2 md:gap-4">
        {home.boxes.map((box) => {
          const open = openKey === (box.key || 'none');
          return <BoxCard key={box.key || 'none'} box={box} open={open} href={qs(open ? null : box.key)} />;
        })}
      </ul>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text2">
        <span className="inline-flex items-center gap-1.5"><Dot color="yellow" className="size-2.5" /> žlutá = čeká na tvou kontrolu</span>
        <span className="inline-flex items-center gap-1.5"><Dot color="green" className="size-2.5" /> zelená = zkontrolováno</span>
        <span className="inline-flex items-center gap-1.5"><Dot color="red" className="size-2.5" /> červená = vráceno Adminovi</span>
      </p>
    </div>
  );
}
