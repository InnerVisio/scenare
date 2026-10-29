import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { ApprovalStatus } from '@/domain/workflow/approval';
import { APPROVAL_STATUS_LABELS } from '@/domain/workflow/approval';
import type { EditorOptions } from '@/server/editorOptions';
import type { Dashboard as DashboardData } from '@/server/queries';
import { ButtonLink } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { CategoryTag } from '@/ui/CategoryTag';
import { cn, focusRing } from '@/ui/cn';
import { cycleLabel } from '@/ui/monthParams';
import { dayMonth, inDays, scriptsLabel, weekdayOf } from './model';

const COLUMN_DOT: Record<ApprovalStatus, string> = {
  draft: 'bg-grey-dot',
  in_review: 'bg-apricot',
  returned: 'bg-coral',
  final_review: 'bg-violet',
  approved: 'bg-lime-dot',
  postponed: 'bg-grey-dot',
  cancelled: 'bg-grey-dot',
};
const CARDS_PER_COLUMN = 3;

export function ActionCard({ data, role }: { data: DashboardData; role: string }) {
  const cycle = data.cycle;
  const deadline = cycle?.approvalDeadline && cycle.daysToDeadline !== null ? `termín schválení ${dayMonth(cycle.approvalDeadline)} (${inDays(cycle.daysToDeadline)})` : null;
  const forShoot = cycle?.shootDate ? `pro natáčení ${dayMonth(cycle.shootDate)}` : null;
  const detail = [forShoot, deadline].filter(Boolean).join(' · ');

  if (role === 'leadership') {
    if (data.awaitingMe === 0) {
      return (
        <Card className="flex flex-col gap-3">
          <p className="text-label uppercase">Ke kontrole</p>
          <p className="text-h2">Nic nečeká na tvou kontrolu.</p>
          {detail && <p className="text-text2">{detail}</p>}
        </Card>
      );
    }
    return (
      <Card tone="lime" className="flex flex-col gap-3">
        <p className="text-label uppercase">Čeká na tvou kontrolu</p>
        <p className="flex items-baseline gap-3">
          <span className="text-display leading-none">{data.awaitingMe}</span>
          <span className="text-h2">{scriptsLabel(data.awaitingMe)}</span>
        </p>
        {detail && <p>{detail}</p>}
        <ButtonLink href="/kontrola" className="mt-auto self-start">
          Začít kontrolu
          <ArrowRight aria-hidden className="size-5" />
        </ButtonLink>
      </Card>
    );
  }
  if (data.returnedToMe > 0) {
    return (
      <Card tone="lime" className="flex flex-col gap-3">
        <p className="text-label uppercase">Vráceno k dopracování</p>
        <p className="flex items-baseline gap-3">
          <span className="text-display leading-none">{data.returnedToMe}</span>
          <span className="text-h2">{scriptsLabel(data.returnedToMe)}</span>
        </p>
        <ButtonLink href="/scenare?stav=returned" className="mt-auto self-start">
          Otevřít
          <ArrowRight aria-hidden className="size-5" />
        </ButtonLink>
      </Card>
    );
  }
  return (
    <Card className="flex flex-col gap-3">
      <p className="text-label uppercase">K dopracování</p>
      <p className="text-h2">Nic se nevrací k dopracování.</p>
    </Card>
  );
}

export function ShootCard({ cycle }: { cycle: DashboardData['cycle'] }) {
  if (!cycle || !cycle.shootDate) {
    return (
      <Card className="flex flex-col gap-3">
        <h2 className="text-h2">Natáčecí den</h2>
        <p className="text-text2">Termín natáčení zatím není stanovený.</p>
      </Card>
    );
  }
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-h2">Natáčecí den</h2>
        {cycle.daysToShoot !== null && <span className="rounded-pill bg-violet-soft px-3 py-1.5 text-sm font-semibold text-violet-ink">{inDays(cycle.daysToShoot)}</span>}
      </div>
      <p className="flex items-baseline gap-3">
        <span className="text-display leading-none">{dayMonth(cycle.shootDate)}</span>
        <span className="text-h2 text-text2">{weekdayOf(cycle.shootDate)}</span>
      </p>
      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-inner bg-nest p-3">
          <dt className="text-sm text-text2">Cíl klipů</dt>
          <dd className="text-h2">{cycle.clipTarget}</dd>
        </div>
        <div className="rounded-inner bg-nest p-3">
          <dt className="text-sm text-text2">Připraveno</dt>
          <dd className="text-h2">
            {cycle.approvedCount} {scriptsLabel(cycle.approvedCount)}
          </dd>
        </div>
      </dl>
      {cycle.locations.length > 0 && (
        <ul className="flex list-none flex-wrap gap-2">
          {cycle.locations.map((l) => (
            <li key={l} className="rounded-pill border border-ink/15 px-3 py-1.5 text-sm">
              {l}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function CommentsCard({ data }: { data: DashboardData }) {
  return (
    <Card tone="dark" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-h2">Otevřené připomínky</h2>
        <span className="text-h1 text-lime">{data.openCommentsTotal}</span>
      </div>
      {data.openComments.length === 0 ? (
        <p className="text-card/70">Žádná otevřená připomínka.</p>
      ) : (
        <ul className="flex list-none flex-col gap-2">
          {data.openComments.map((c, i) => (
            <li key={`${c.videoCode}-${i}`} className="rounded-inner bg-ink2 p-3">
              <p className="text-sm text-card/70">
                {c.videoCode} · {c.author} · {c.typeLabel}
              </p>
              <p className="mt-1 line-clamp-3">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
      {data.openCommentsTotal > data.openComments.length && (
        <Link href="/scenare" className={cn('mt-auto inline-flex min-h-12 items-center font-semibold text-lime underline', focusRing)}>
          Zobrazit všech {data.openCommentsTotal}
        </Link>
      )}
    </Card>
  );
}

export function PhaseThreeCard() {
  return (
    <Card className="flex flex-col gap-1">
      <h2 className="text-h2">Přehled mixu přijde ve fázi 3</h2>
      <p className="text-text2">Tematický mix, plnění měsíce a série se zobrazí, až bude hotová publikace a statistiky.</p>
    </Card>
  );
}

export function Kanban({ data, categories }: { data: DashboardData; categories: EditorOptions['categories'] }) {
  const cycle = data.cycle;
  if (!cycle) return null;
  const columns = (Object.keys(data.kanban) as ApprovalStatus[]).filter(
    (status) => data.kanban[status].length > 0 || !(status === 'postponed' || status === 'cancelled'),
  );
  const total = columns.reduce((sum, status) => sum + data.kanban[status].length, 0);
  const category = (key: string | null) => categories.find((c) => c.key === key);
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-h2">{cycleLabel(cycle.id)} · kde co vázne</h2>
        <p className="text-sm text-text2">
          {total} {scriptsLabel(total)}
        </p>
      </div>
      <div className="grid gap-3 md:auto-cols-[minmax(240px,1fr)] md:grid-flow-col md:overflow-x-auto">
        {columns.map((status) => {
          const items = data.kanban[status];
          const rest = items.length - CARDS_PER_COLUMN;
          return (
            <section key={status} aria-label={APPROVAL_STATUS_LABELS[status]} className="flex flex-col gap-2 rounded-inner bg-nest p-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <span aria-hidden className={cn('size-2.5 rounded-full', COLUMN_DOT[status])} />
                <span className="flex-1">{APPROVAL_STATUS_LABELS[status]}</span>
                <span className="text-text2">{items.length}</span>
              </h3>
              {items.slice(0, CARDS_PER_COLUMN).map((item) => {
                const cat = category(item.categoryKey);
                return (
                  <Link key={item.id} href={`/scenare/${item.code}`} className={cn('flex min-h-12 flex-col gap-2 rounded-inner bg-card p-3', focusRing)}>
                    <span className="text-label uppercase text-text2">{item.code}</span>
                    <span className="font-semibold">{item.title}</span>
                    <span className="flex items-center justify-between gap-2">
                      {cat ? <CategoryTag categoryKey={cat.key} label={cat.label} short={cat.short} colors={cat} /> : <span />}
                      <span className="text-sm text-text2">{item.castInitials}</span>
                    </span>
                  </Link>
                );
              })}
              {rest > 0 && (
                <Link href={`/scenare?cyklus=${cycle.id}&stav=${status}`} className={cn('inline-flex min-h-12 items-center font-semibold text-violet underline', focusRing)}>
                  +{rest} {rest === 1 ? 'další' : rest <= 4 ? 'další' : 'dalších'}
                </Link>
              )}
            </section>
          );
        })}
      </div>
    </Card>
  );
}
