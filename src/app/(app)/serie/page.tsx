import Link from 'next/link';
import { Layers } from 'lucide-react';
import { getDb } from '@/db/client';
import { can } from '@/domain/policy/can';
import { isArchivedSeries, SERIES_STATUS_LABELS, type SeriesStatus } from '@/domain/series/status';
import { requireActor } from '@/server/auth/session';
import { categoryOptions } from '@/server/editorOptions';
import { loadSeriesList } from '@/server/series';
import { listLookups } from '@/server/settings';
import { CategoryTag } from '@/ui/CategoryTag';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { TopBar } from '@/ui/TopBar';
import { cn, focusRing } from '@/ui/cn';
import { plural } from '../_components/review/model';
import { NewSeriesButton } from './NewSeriesButton';
import { ProgressBar } from './ProgressBar';

export const metadata = { title: 'Série – GTA Scénáře' };
export const dynamic = 'force-dynamic';

export default async function SeriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor();
  const showAll = (await searchParams).vse === '1';
  const db = await getDb();
  const [all, lookups] = await Promise.all([loadSeriesList(db), listLookups(db, 'category')]);
  const categories = categoryOptions(lookups);
  const hidden = all.filter((x) => isArchivedSeries(x.status)).length;
  const items = showAll ? all : all.filter((x) => !isArchivedSeries(x.status));

  return (
    <div className="flex flex-col gap-4">
      <TopBar title="Série" subtitle={`${items.length} ${plural(items.length, 'série', 'série', 'sérií')}`} hidePeriod />
      <div className="flex flex-wrap items-center gap-3">
        {can(actor, 'series.manage') && <NewSeriesButton />}
        {(hidden > 0 || showAll) && (
          <Link
            href={showAll ? '/serie' : '/serie?vse=1'}
            className={cn('inline-flex min-h-12 items-center rounded-pill border border-ink/15 bg-card px-6 font-semibold', focusRing)}
          >
            {showAll ? 'Skrýt uzavřené a zrušené' : 'Zobrazit uzavřené a zrušené'}
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <EmptyState icon={Layers} title="Zatím tu nejsou žádné série." description={can(actor, 'series.manage') ? 'Začni tlačítkem „Nová série“.' : undefined} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((x) => {
            const category = categories.find((c) => c.key === x.mainCategoryKey);
            return (
              <li key={x.id}>
                <Link href={`/serie/${x.code}`} className={cn('block rounded-card', focusRing)}>
                  <Card className="flex h-full flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-text2">{x.code}</span>
                      {category && <CategoryTag categoryKey={category.key} label={category.label} short={category.short} colors={category} />}
                      {x.metrics.canClose && x.status !== 'closed' && (
                        <span className="inline-flex items-center rounded-pill bg-lime-soft px-3 py-1.5 text-sm leading-none font-semibold text-lime-ink">Lze uzavřít</span>
                      )}
                    </div>
                    <h2 className="text-h2">{x.name}</h2>
                    <p className="text-text2">
                      {SERIES_STATUS_LABELS[x.status as SeriesStatus] ?? x.status}
                      {x.guarantorName ? ` · garant ${x.guarantorName}` : ''}
                    </p>
                    <ProgressBar value={x.metrics.published} max={x.metrics.planned} />
                    <p className="text-sm font-semibold">
                      Publikováno {x.metrics.published} z {x.plannedEpisodes ?? '?'}
                    </p>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
