import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getDb } from '@/db/client';
import { formatDateTime } from '@/domain/format/date';
import { can } from '@/domain/policy/can';
import { SERIES_STATUS_LABELS, type SeriesStatus } from '@/domain/series/status';
import { PRODUCTION_STATUS_LABELS, type ProductionStatus } from '@/domain/workflow/production';
import type { ApprovalStatus } from '@/domain/workflow/approval';
import { requireActor } from '@/server/auth/session';
import { categoryOptions } from '@/server/editorOptions';
import { DomainError } from '@/server/errors';
import { leadershipUsers } from '@/server/loaders';
import { loadSeriesDetail } from '@/server/series';
import { listLookups } from '@/server/settings';
import { Card, CardTitle } from '@/ui/Card';
import { StatusPill } from '@/ui/StatusPill';
import { TopBar } from '@/ui/TopBar';
import { cn, focusRing } from '@/ui/cn';
import { CloseSeries } from './CloseSeries';
import { NewEpisodeButton } from './NewEpisodeButton';
import { SeriesEditForm } from './SeriesEditForm';
import { ProgressBar } from '../ProgressBar';

export const metadata = { title: 'Série – GTA Scénáře' };
export const dynamic = 'force-dynamic';

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-inner bg-nest p-4">
      <dd className="text-h2">{value}</dd>
      <dt className="text-sm text-text2">{label}</dt>
    </div>
  );
}

export default async function SeriesDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const actor = await requireActor();
  const { code } = await params;
  const db = await getDb();
  const manage = can(actor, 'series.manage');
  let detail;
  try {
    detail = await loadSeriesDetail(db, decodeURIComponent(code).toUpperCase());
  } catch (error) {
    if (error instanceof URIError || (error instanceof DomainError && error.code === 'NOT_FOUND')) notFound();
    throw error;
  }
  const [lookups, guarantors] = await Promise.all([listLookups(db, 'category'), manage ? leadershipUsers(db) : Promise.resolve([])]);
  const categories = categoryOptions(lookups);
  const { series, metrics, episodes } = detail;
  const closed = series.status === 'closed';

  return (
    <div className="flex flex-col gap-4">
      <Link href="/serie" className={cn('inline-flex min-h-12 w-fit items-center gap-1 rounded-pill pr-4 font-semibold text-text2', focusRing)}>
        <ChevronLeft aria-hidden className="size-5" />
        Série
      </Link>
      <TopBar
        title={`${series.code} · ${series.name}`}
        subtitle={`${SERIES_STATUS_LABELS[series.status as SeriesStatus] ?? series.status}${detail.guarantorName ? ` · garant ${detail.guarantorName}` : ''}`}
        hidePeriod
      />

      <Card className="flex flex-col gap-4">
        <ProgressBar value={metrics.published} max={metrics.planned} />
        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="Plán dílů" value={series.plannedEpisodes ?? '?'} />
          <Metric label="Se scénářem" value={metrics.withScript} />
          <Metric label="Schváleno" value={metrics.approved} />
          <Metric label="Natočeno" value={metrics.shot} />
          <Metric label="Publikováno" value={`${metrics.published} (${metrics.fulfilmentPct} %)`} />
          <Metric label="Zbývá dílů" value={metrics.remaining} />
          <Metric label="Otevřené připomínky" value={metrics.openComments} />
          <Metric label="Publikace bez odkazu" value={metrics.publicationsWithoutUrl} />
        </dl>
        {series.goal && <p className="text-text2">{series.goal}</p>}
        {metrics.checks.length > 0 && (
          <ul className="rounded-inner bg-danger-bg p-4 text-danger-text">
            {metrics.checks.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        )}
        {closed ? (
          <p className="font-semibold">
            Uzavřeno{detail.closedByName ? ` – ${detail.closedByName}` : ''}
            {series.closedAt ? `, ${formatDateTime(series.closedAt)}` : ''}.
          </p>
        ) : (
          manage && <CloseSeries seriesId={series.id} canClose={metrics.canClose} reasons={metrics.reasons} />
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Díly</CardTitle>
          {manage && <NewEpisodeButton seriesId={series.id} />}
        </div>
        {episodes.length === 0 ? (
          <p className="text-text2">Série zatím nemá žádný díl.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {episodes.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/scenare/${e.code}`}
                  className={cn('flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 rounded-inner bg-nest px-4 py-3', focusRing)}
                >
                  <span className="font-semibold text-text2">Díl {e.episodeNo ?? '?'}</span>
                  <span className="text-sm text-text2">{e.code}</span>
                  <span className="min-w-0 flex-1 basis-40 font-semibold">{e.title}</span>
                  <StatusPill status={e.approvalStatus as ApprovalStatus} />
                  <span className="text-sm text-text2">{PRODUCTION_STATUS_LABELS[e.productionStatus as ProductionStatus] ?? e.productionStatus}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {manage && (
        <SeriesEditForm
          key={`${series.id}-${series.status}-${series.plannedEpisodes}`}
          value={{
            id: series.id,
            name: series.name,
            mainCategoryKey: series.mainCategoryKey,
            goal: series.goal,
            guarantorId: series.guarantorId,
            plannedEpisodes: series.plannedEpisodes,
            scopeChangeReason: series.scopeChangeReason,
            startDate: series.startDate,
            expectedEnd: series.expectedEnd,
            note: series.note,
            status: series.status,
          }}
          categories={categories}
          guarantors={guarantors}
        />
      )}
    </div>
  );
}
