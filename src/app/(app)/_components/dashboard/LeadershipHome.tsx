import Link from 'next/link';
import type { LeadershipHome } from '@/server/queries';
import { ButtonLink } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { CategoryTag } from '@/ui/CategoryTag';
import { TopBar } from '@/ui/TopBar';
import { cn, focusRing } from '@/ui/cn';
import { dayMonth, daysLabel, greeting, scriptsLabel } from './model';

const inDays = (n: number | null) => (n === null ? '' : n < 0 ? 'po termínu' : n === 0 ? 'dnes' : `za ${daysLabel(n)}`);

/** Simple home for leadership: one thing to do (review), what is waiting, and a glance at the shoot. */
export function LeadershipHomeView({ name, now, data }: { name: string; now: Date; data: LeadershipHome }) {
  const { queue, cycle, categories } = data;
  const todo = queue.filter((i) => !i.decidedByActor).length;
  return (
    <>
      <TopBar title={greeting(now, name)} size="display" hidePeriod />
      <div className="flex flex-col gap-4 md:max-w-2xl md:gap-6">
        {todo > 0 ? (
          <Card className="flex flex-col gap-4">
            <div>
              <h2 className="text-h1">Ke kontrole: {todo} {scriptsLabel(todo)}</h2>
              {cycle?.approvalDeadline && (
                <p className="mt-1 text-text2">
                  termín schválení {dayMonth(cycle.approvalDeadline)} ({inDays(cycle.daysToDeadline)})
                </p>
              )}
            </div>
            <ButtonLink href="/kontrola" variant="primary" className="min-h-14 w-full text-lg">
              Začít kontrolu →
            </ButtonLink>
          </Card>
        ) : (
          <Card className="flex flex-col gap-3">
            <h2 className="text-h1">Všechno máš zkontrolované 🎉</h2>
            <Link href="/nataceni" className={cn('inline-flex min-h-12 items-center font-semibold text-violet underline', focusRing)}>
              Co budeme točit
            </Link>
          </Card>
        )}
        {queue.length > 0 && (
          <ul aria-label="Fronta ke kontrole" className="flex flex-col gap-2">
            {queue.map((item) => {
              const cat = categories.find((c) => c.key === item.categoryKey);
              return (
                <li key={item.videoId}>
                  <Link
                    href={`/kontrola/${item.code}`}
                    className={cn('flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 rounded-inner bg-card p-3', focusRing, item.decidedByActor && 'opacity-60')}
                  >
                    <span className="text-label uppercase text-text2">{item.code}</span>
                    <span className="min-w-0 flex-1 font-semibold">{item.title}</span>
                    {cat && <CategoryTag categoryKey={cat.key} label={cat.label} short={cat.short} colors={cat} />}
                    <span className="text-sm text-text2">
                      {item.decidedByActor ? '✓ schváleno' : item.versionNo > 1 ? 'změny od v1' : 'nový'}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {cycle?.shootDate && (
          <Link href="/nataceni" className={cn('rounded-card', focusRing)}>
            <Card className="text-text2">
              Natáčení {dayMonth(cycle.shootDate)} · {inDays(cycle.daysToShoot)} · {cycle.approvedCount} {cycle.approvedCount === 1 ? 'schválený scénář' : 'schválených scénářů'}
            </Card>
          </Link>
        )}
      </div>
    </>
  );
}
