import { MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { formatDayMonth } from '@/domain/format/date';
import type { QueueItemVM, ReviewData } from '@/server/review';
import { CategoryTag } from '@/ui/CategoryTag';
import { cn, focusRing } from '@/ui/cn';

function deadlineText(cycle: NonNullable<ReviewData['cycle']>): string | null {
  if (!cycle.deadline) return null;
  const date = formatDayMonth(new Date(`${cycle.deadline}T12:00:00Z`));
  const days = cycle.daysToDeadline;
  if (days === null) return `Termín schválení ${date}`;
  if (days > 0) return `Termín schválení ${date} · za ${days} ${days === 1 ? 'den' : days <= 4 ? 'dny' : 'dní'}`;
  if (days === 0) return `Termín schválení ${date} · dnes`;
  return `Termín schválení ${date} · po termínu`;
}

/** Dark queue column (desktop): what is waiting for the actor, active script in lime. */
export function QueueList({
  queue,
  activeCode,
  position,
  cycle,
  query,
}: {
  queue: QueueItemVM[];
  activeCode: string;
  position: number | null;
  cycle: ReviewData['cycle'];
  /** `?cyklus=…` (or empty), preserved when moving between scripts. */
  query: string;
}) {
  const deadline = cycle ? deadlineText(cycle) : null;
  return (
    <nav aria-label="Fronta ke kontrole" className="flex max-h-full flex-col gap-4 overflow-hidden rounded-card bg-ink p-5 text-card">
      <header>
        <p className="text-label tracking-[0.12em] text-lime uppercase">
          Ke kontrole · {position ?? '–'} / {queue.length}
        </p>
        {cycle?.shootDate && (
          <h2 className="mt-1 text-[26px] leading-tight font-semibold">
            Natáčení {formatDayMonth(new Date(`${cycle.shootDate}T12:00:00Z`))}
          </h2>
        )}
        {deadline && <p className="mt-1 text-sm text-card/60">{deadline}</p>}
      </header>
      <ol className="-mr-2 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-2">
        {queue.map((item) => {
          const active = item.code === activeCode;
          return (
            <li key={item.videoId}>
              <Link
                href={`/kontrola/${item.code}${query}`}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'flex min-h-12 flex-col gap-2 rounded-inner p-4',
                  focusRing,
                  active ? 'bg-lime text-ink' : 'bg-ink2 text-card hover:bg-ink2/80',
                )}
              >
                <span className="flex items-center justify-between gap-3 text-xs font-semibold tracking-[0.06em] uppercase">
                  <span className={active ? 'text-ink/70' : 'text-card/60'}>
                    {item.code} · v{item.versionNo}
                    {item.isFinal ? ' · finální' : ''}
                    {item.decidedByActor ? ' · schválil jsi' : ''}
                  </span>
                  {item.openComments > 0 && (
                    <span className="inline-flex items-center gap-1" aria-label={`${item.openComments} nevyřešených komentářů`}>
                      <MessageSquare aria-hidden className="size-3.5" />
                      {item.openComments}
                    </span>
                  )}
                </span>
                <span className="text-base leading-snug font-semibold">{item.title}</span>
                {item.category && (
                  <CategoryTag
                    categoryKey={item.categoryKey ?? ''}
                    label={item.category.label}
                    short={item.category.short}
                    colors={item.category.colors}
                    className="w-fit px-2.5 py-1 text-xs"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
