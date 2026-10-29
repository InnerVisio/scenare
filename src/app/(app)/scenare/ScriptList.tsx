import { MessageSquare } from 'lucide-react';
import Link from 'next/link';
import type { ApprovalStatus } from '@/domain/workflow/approval';
import { PRODUCTION_STATUS_LABELS, type ProductionStatus } from '@/domain/workflow/production';
import type { EditorOptions } from '@/server/editorOptions';
import type { VideoListItem } from '@/server/queries';
import { CategoryTag } from '@/ui/CategoryTag';
import { cn, focusRing } from '@/ui/cn';
import { FormatTag } from '@/ui/FormatTag';
import { StatusPill } from '@/ui/StatusPill';
import { rowTone, type RowTone } from './listModel';

const STRIPE: Record<Exclude<RowTone, null>, { bar: string; label: string }> = {
  coral: { bar: 'bg-coral', label: 'Vyžaduje pozornost' },
  apricot: { bar: 'bg-apricot', label: 'Čeká na rozhodnutí' },
  lime: { bar: 'bg-lime-dot', label: 'Schváleno' },
};

type Options = Pick<EditorOptions, 'categories' | 'formats' | 'series'>;

function cycleText(id: string | null) {
  return id ? id.replace('-', '–') : '—';
}

function Stripe({ tone, className }: { tone: RowTone; className: string }) {
  if (!tone) return null;
  return (
    <>
      <span aria-hidden className={cn('absolute rounded-full', STRIPE[tone].bar, className)} />
      <span className="sr-only">{STRIPE[tone].label}. </span>
    </>
  );
}

function Comments({ count }: { count: number }) {
  return count > 0 ? (
    <span className="inline-flex items-center gap-1.5 font-semibold" aria-label={`${count} otevřených komentářů`}>
      <MessageSquare aria-hidden className="size-4 text-text2" />
      {count}
    </span>
  ) : (
    <span className="text-text2" aria-label="Bez otevřených komentářů">
      —
    </span>
  );
}

/** Table (desktop) and „Karta scénáře“ cards (phones and tablets) of the same scripts. */
export function ScriptList({ items, options, today }: { items: VideoListItem[]; options: Options; today: string }) {
  const categories = new Map(options.categories.map((c) => [c.key, c]));
  const formats = new Map(options.formats.map((f) => [f.key, f]));
  const seriesCode = new Map(options.series.map((s) => [s.key, s.label.split(' · ')[0]]));

  const duration = (item: VideoListItem) => (item.durationSec === null ? '—' : `${item.durationSec} s`);
  const production = (item: VideoListItem) => PRODUCTION_STATUS_LABELS[item.productionStatus as ProductionStatus] ?? item.productionStatus;
  const tone = (item: VideoListItem) => rowTone(item, today);

  const categoryTag = (item: VideoListItem) => {
    const category = item.categoryKey ? categories.get(item.categoryKey) : undefined;
    return category ? (
      <CategoryTag categoryKey={category.key} label={category.label} short={category.short} colors={{ color: category.color, textColor: category.textColor }} />
    ) : (
      <span className="text-text2">Bez kategorie</span>
    );
  };

  return (
    <>
      <div className="hidden overflow-hidden rounded-card bg-card lg:block">
        <table className="w-full text-left">
          <thead>
            <tr className="text-label tracking-[0.06em] text-text2 uppercase">
              <th className="py-4 pr-3 pl-7 font-semibold">Kód</th>
              <th className="px-3 py-4 font-semibold">Název</th>
              <th className="px-3 py-4 font-semibold">Kategorie</th>
              <th className="px-3 py-4 font-semibold">Stav</th>
              <th className="px-3 py-4 font-semibold">Výroba</th>
              <th className="px-3 py-4 font-semibold">Cyklus</th>
              <th className="px-3 py-4 font-semibold">Délka</th>
              <th className="py-4 pr-6 pl-3 font-semibold">Komentáře</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} data-code={item.code} className="relative border-t border-ink/10 hover:bg-nest">
                <td className="relative py-4 pr-3 pl-7 font-semibold whitespace-nowrap text-text2">
                  <Stripe tone={tone(item)} className="inset-y-3 left-0 w-1.5 rounded-l-none" />
                  {item.code}
                </td>
                <td className="min-w-48 px-3 py-4 font-semibold">
                  <Link href={`/scenare/${item.code}`} className={cn('rounded-lg after:absolute after:inset-0', focusRing)}>
                    {item.title}
                  </Link>
                </td>
                <td className="px-3 py-4">{categoryTag(item)}</td>
                <td className="px-3 py-4">
                  <StatusPill status={item.approvalStatus as ApprovalStatus} />
                </td>
                <td className="px-3 py-4 text-text2">{production(item)}</td>
                <td className="px-3 py-4 whitespace-nowrap text-text2">{cycleText(item.cycleId)}</td>
                <td className="px-3 py-4 whitespace-nowrap">{duration(item)}</td>
                <td className="py-4 pr-6 pl-3">
                  <Comments count={item.openComments} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="grid gap-3 md:grid-cols-2 lg:hidden">
        {items.map((item) => {
          const format = item.formatKey ? formats.get(item.formatKey) : undefined;
          const series = item.seriesId ? seriesCode.get(item.seriesId) : undefined;
          return (
            <li key={item.id} data-code={item.code} className="relative flex flex-col gap-3 rounded-card bg-card p-5 pl-7">
              <Stripe tone={tone(item)} className="inset-y-5 left-0 w-1.5 rounded-l-none" />
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold tracking-[0.04em] text-text2">
                  {item.code}
                  {item.latestVersionNo ? ` · v${item.latestVersionNo}` : ''} · {duration(item)}
                </p>
                <StatusPill status={item.approvalStatus as ApprovalStatus} />
              </div>
              <h2 className="text-h2 text-balance">
                <Link href={`/scenare/${item.code}`} className={cn('rounded-lg after:absolute after:inset-0 after:rounded-card', focusRing)}>
                  {item.title}
                </Link>
              </h2>
              <div className="flex flex-wrap gap-2">
                {categoryTag(item)}
                {format?.status === 'verified' && <FormatTag kind="verified">ověřený</FormatTag>}
                {item.isTrialReel && <FormatTag kind="test">Nový test · Trial Reel</FormatTag>}
                {series && (
                  <FormatTag kind="series">
                    Série {series}
                    {item.episodeNo ? ` · díl ${item.episodeNo}` : ''}
                  </FormatTag>
                )}
              </div>
              <div className="flex items-center justify-between gap-3 text-sm text-text2">
                <span className="min-w-0 truncate">
                  {item.castInitials} · {production(item)}
                </span>
                <Comments count={item.openComments} />
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
