import { ExternalLink, Megaphone } from 'lucide-react';
import Link from 'next/link';
import { getDb } from '@/db/client';
import { formatDateTime } from '@/domain/format/date';
import { formatRate } from '@/domain/metrics/publication';
import { currentMonthOf, loadPublicationsPage, type PublicationVM } from '@/server/publications';
import { requireActor } from '@/server/auth/session';
import { Card } from '@/ui/Card';
import { EmptyState } from '@/ui/EmptyState';
import { TopBar } from '@/ui/TopBar';
import { cn, focusRing } from '@/ui/cn';
import { monthLabel, parseMonthParam } from '@/ui/monthParams';
import { plural } from '../_components/review/model';

export const metadata = { title: 'Publikace – GTA Scénáře' };
export const dynamic = 'force-dynamic';

const num = new Intl.NumberFormat('cs-CZ');

function LinkCell({ p }: { p: PublicationVM }) {
  return p.url ? (
    <a href={p.url} target="_blank" rel="noopener noreferrer" className={cn('inline-flex min-h-12 items-center gap-1 font-semibold text-violet underline', focusRing)}>
      Odkaz <ExternalLink aria-hidden className="size-4" />
    </a>
  ) : (
    <span className="text-sm font-semibold text-apricot-ink">Bez odkazu</span>
  );
}

function Metrics({ p }: { p: PublicationVM }) {
  return (
    <p className="text-sm text-text2">
      Dosah 7 d: <b className="text-ink">{p.reach7d === null ? '—' : num.format(p.reach7d)}</b> · sdílení/dosah: <b className="text-ink">{formatRate(p.shareRate7d)}</b>
    </p>
  );
}

export default async function PublicationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireActor();
  const params = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const now = new Date();
  const month = parseMonthParam(first(params.mesic), currentMonthOf(now));
  const noLink = first(params.bez) === 'odkaz';
  const page = await loadPublicationsPage(await getDb(), month, noLink);
  const keep = (extra: Record<string, string>) => {
    const q = new URLSearchParams();
    for (const key of ['mesic', 'cyklus']) {
      const v = first(params[key]);
      if (v) q.set(key, v);
    }
    for (const [k, v] of Object.entries(extra)) q.set(k, v);
    const query = q.toString();
    return query ? `/publikace?${query}` : '/publikace';
  };

  return (
    <div className="flex flex-col gap-4">
      <TopBar
        title="Publikace"
        subtitle={`${monthLabel(month)} · ${page.publicationCount} ${plural(page.publicationCount, 'publikace', 'publikace', 'publikací')} · ${page.videoCount} ${plural(page.videoCount, 'video', 'videa', 'videí')}`}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={noLink ? keep({}) : keep({ bez: 'odkaz' })}
          aria-pressed={noLink}
          className={cn('inline-flex min-h-12 items-center rounded-pill border border-ink/15 px-6 font-semibold', noLink ? 'bg-ink text-card' : 'bg-card', focusRing)}
        >
          Bez odkazu ({page.withoutUrl})
        </Link>
      </div>

      {page.rows.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={noLink ? 'Všechny publikace mají odkaz.' : 'V tomto měsíci zatím nejsou žádné publikace.'}
          description={noLink ? undefined : 'Publikaci přidáš na detailu schváleného scénáře.'}
        />
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Publikace">
          {page.rows.map((p) => (
            <li key={p.id}>
              <Card className="flex flex-col gap-2 md:flex-row md:items-center md:gap-6">
                <p className="text-sm font-semibold text-text2 md:w-40">{formatDateTime(new Date(p.publishedAt))}</p>
                <div className="min-w-0 flex-1">
                  <Link href={`/scenare/${p.code}`} className={cn('font-semibold underline-offset-2 hover:underline', focusRing)}>
                    {p.code} · {p.title}
                  </Link>
                  <p className="text-text2">
                    {p.profileLabel} · {p.variantLabel}
                  </p>
                </div>
                <Metrics p={p} />
                <LinkCell p={p} />
              </Card>
            </li>
          ))}
        </ul>
      )}

      {page.groups.length > 0 && (
        <section aria-label="A/B varianty" className="flex flex-col gap-3">
          <h2 className="text-h2 px-1">A/B varianty</h2>
          {page.groups.map((g) => (
            <Card key={g.videoId} className="flex flex-col gap-3">
              <Link href={`/scenare/${g.code}`} className={cn('font-semibold underline-offset-2 hover:underline', focusRing)}>
                {g.code} · {g.title}
              </Link>
              <div className="grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(14rem,1fr))]">
                {g.rows.map((p) => (
                  <Card key={p.id} inner tone="nest" className="flex flex-col gap-1">
                    <p className="font-semibold">{p.variantLabel}</p>
                    <p className="text-sm text-text2">{p.profileLabel}</p>
                    <Metrics p={p} />
                  </Card>
                ))}
              </div>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
