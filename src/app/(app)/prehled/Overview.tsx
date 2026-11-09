import Link from 'next/link';
import type { ReactNode } from 'react';
import { OVERVIEW_STATUS_LABELS, type CharacterRow, type HistoryRow, type OverviewMixRow } from '@/domain/metrics/overview';
import { SERIES_STATUS_LABELS, type SeriesStatus } from '@/domain/series/status';
import type { Overview } from '@/server/overview';
import { Card } from '@/ui/Card';
import { cn, focusRing } from '@/ui/cn';
import { cycleLabel, monthLabel } from '@/ui/monthParams';
import { toListHref, type ListQuery } from '../scenare/listModel';

const pct = (n: number | null) => (n === null ? '' : `${Math.round(n * 100)} %`);

/** A count that opens /scenare with the matching filters. */
function Count({ n, query, danger }: { n: number; query: ListQuery; danger?: boolean }) {
  return (
    <Link
      href={toListHref(query)}
      className={cn('inline-flex min-h-8 min-w-8 items-center justify-center font-semibold underline underline-offset-2', danger && n > 0 && 'text-danger-text', focusRing)}
    >
      {n}
    </Link>
  );
}

function tone(label: string): string {
  if (/^(CHYBÍ|MIMO)/.test(label)) return 'bg-danger-bg text-danger-text';
  if (/^Čeká/.test(label)) return 'bg-apricot-soft text-apricot-ink';
  if (/^(Schv|Publ|OK)/.test(label)) return 'bg-nest text-lime-ink';
  return 'bg-nest text-text2';
}

function Chip({ label }: { label: string }) {
  return <span className={cn('inline-block rounded-pill px-3 py-1 text-sm font-semibold whitespace-nowrap', tone(label))}>{label}</span>;
}

interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  align?: 'right';
}

/** Table from 1024 px, one card per row (label: value) below. The first column is the card's title. */
function DataTable<T>({ label, columns, rows, mobileRows, rowKey, bold }: { label: string; columns: Column<T>[]; rows: T[]; mobileRows?: T[]; rowKey: (row: T) => string; bold?: (row: T) => boolean }) {
  const [title, ...rest] = columns;
  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        <table aria-label={label} className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-ink/15 text-sm text-text2">
              {columns.map((c) => (
                <th key={c.header} scope="col" className={cn('px-2 py-2 font-semibold', c.align === 'right' && 'text-right')}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className={cn('border-b border-ink/10', bold?.(row) && 'bg-nest font-bold')}>
                {columns.map((c, i) => (
                  <td key={c.header} className={cn('px-2 py-2', c.align === 'right' && 'text-right')}>
                    {i === 0 ? <span className="font-semibold">{c.cell(row)}</span> : c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul aria-label={label} className="flex list-none flex-col gap-3 lg:hidden">
        {(mobileRows ?? rows).map((row) => (
          <li key={rowKey(row)} className={cn('flex flex-col gap-2 rounded-inner p-4', bold?.(row) ? 'bg-nest' : 'bg-nest/60')}>
            <p className="font-semibold">{title.cell(row)}</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {rest.map((c) => (
                <div key={c.header} className="flex min-w-0 flex-col">
                  <dt className="text-text2">{c.header}</dt>
                  <dd className="min-w-0 break-words">{c.cell(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-h2">{title}</h2>
        {hint && <p className="text-sm text-text2">{hint}</p>}
      </div>
      {children}
    </Card>
  );
}

type Dim = 'kategorie' | 'typ';

function mixColumns(base: ListQuery, dim: Dim, opts: { publication: boolean }): Column<OverviewMixRow>[] {
  const q = (row: OverviewMixRow, extra: ListQuery): ListQuery => ({ ...base, ...(row.key === 'total' ? {} : { [dim]: row.key }), ...extra });
  const columns: Column<OverviewMixRow>[] = [
    { header: dim === 'kategorie' ? 'Kategorie' : 'Typ zpracování', cell: (r) => r.label },
    { header: 'Cíl %', cell: (r) => pct(r.share), align: 'right' },
    { header: 'Plán (ks)', cell: (r) => r.plan, align: 'right' },
    { header: 'Navrženo', cell: (r) => <Count n={r.proposed} query={q(r, { aktivni: '1' })} />, align: 'right' },
    { header: 'Schváleno', cell: (r) => <Count n={r.approved} query={q(r, { stav: 'approved' })} />, align: 'right' },
    { header: 'Chybí ke schválení', cell: (r) => <span className={cn(r.missing > 0 && 'font-semibold text-danger-text')}>{r.missing}</span>, align: 'right' },
    { header: 'Natočeno', cell: (r) => <Count n={r.shot} query={q(r, { natoceno: '1' })} />, align: 'right' },
  ];
  if (opts.publication) {
    const { mesic, ...rest } = base;
    columns.push(
      { header: 'Publikováno', cell: (r) => <Count n={r.published} query={{ ...rest, ...(r.key === 'total' ? {} : { [dim]: r.key }), publikovano: mesic }} />, align: 'right' },
      { header: 'Plnění', cell: (r) => pct(r.fulfilment), align: 'right' },
    );
  }
  columns.push({ header: 'Stav', cell: (r) => <Chip label={OVERVIEW_STATUS_LABELS[r.status]} /> });
  return columns;
}

function MixTable({ label, mix, base, dim, publication }: { label: string; mix: { rows: OverviewMixRow[]; total: OverviewMixRow }; base: ListQuery; dim: Dim; publication: boolean }) {
  return <DataTable label={label} columns={mixColumns(base, dim, { publication })} rows={[...mix.rows, mix.total]} rowKey={(r) => r.key} bold={(r) => r.key === 'total'} />;
}

const CHAR_STATUS = { none: '', ok: 'OK', out: 'MIMO POMĚR' } as const;

function characterColumns(month: string): Column<CharacterRow>[] {
  const base = (r: CharacterRow): ListQuery => ({ profil: r.profileKey, charakter: r.characterKey });
  return [
    { header: 'Profil', cell: (r) => `${r.profileLabel} – ${r.characterLabel}` },
    { header: 'Cíl %', cell: (r) => pct(r.target), align: 'right' },
    { header: 'Scénáře (ks)', cell: (r) => <Count n={r.scripts} query={{ ...base(r), mesic: month, aktivni: '1' }} />, align: 'right' },
    { header: 'Scénáře %', cell: (r) => pct(r.scriptShare), align: 'right' },
    { header: 'Stav přípravy', cell: (r) => <Chip label={CHAR_STATUS[r.prepStatus] || '– (žádné scénáře)'} /> },
    { header: 'Publikováno (ks)', cell: (r) => <Count n={r.published} query={{ ...base(r), publikovano: month }} />, align: 'right' },
    { header: 'Publikováno %', cell: (r) => pct(r.publishedShare), align: 'right' },
    { header: 'Stav publikace', cell: (r) => <Chip label={CHAR_STATUS[r.publicationStatus] || '– (nic nepublikováno)'} /> },
  ];
}

interface Indicator {
  label: string;
  note: string;
  selected: ReactNode;
  all: ReactNode;
}

function cycleIndicators(o: Overview): Indicator[] {
  const cs = o.cycleStatus!;
  const cyklus = o.cycleId ?? undefined;
  const link = (pick: (c: typeof cs.selected) => number, query: ListQuery, danger = false) => ({
    selected: <Count n={pick(cs.selected)} query={{ cyklus, ...query }} danger={danger} />,
    all: <Count n={pick(cs.all)} query={query} danger={danger} />,
  });
  return [
    { label: 'Plán videí pro cyklus', note: 'Z nastavení cyklu.', selected: cs.plan, all: '–' },
    { label: 'Scénářů celkem (bez odložených a zrušených)', note: 'Vše, co marketéři vložili.', ...link((c) => c.total, { aktivni: '1' }) },
    { label: 'Čeká na zpětnou vazbu vedení', note: 'K připomínkám + K finálnímu schválení. Další krok: Honza / Radek.', ...link((c) => c.awaitingLeadership, { stav: 'in_review,final_review' }) },
    { label: 'Čeká na marketéry', note: 'Rozpracováno + K dopracování. Další krok: marketing.', ...link((c) => c.awaitingMarketers, { stav: 'draft,returned' }) },
    { label: 'Schváleno', note: '', ...link((c) => c.approved, { stav: 'approved' }) },
    { label: 'Chybí schválených do plánu cyklu', note: 'Plán − schváleno.', selected: <span className={cn(cs.missingApproved > 0 && 'font-semibold text-danger-text')}>{cs.missingApproved}</span>, all: '–' },
    { label: 'Schváleno a čeká na natáčení', note: 'Před natáčením.', ...link((c) => c.approvedWaitingForShoot, { stav: 'approved', vyroba: 'waiting' }) },
    { label: 'Po termínu odevzdání scénáře (neschválené)', note: 'Termín odevzdání scénáře už prošel.', ...link((c) => c.overdueScripts, { 'po-terminu': '1' }, true) },
    { label: 'Neschváleno po termínu schválení cyklu', note: 'Termín schválení (datum natáčení − N dní) prošel a scénář není schválen.', ...link((c) => c.unapprovedAfterDeadline, { stav: 'draft,in_review,returned,final_review' }, true) },
    { label: 'Otevřené připomínky', note: 'Nevyřešené připomínky.', ...link((c) => c.openComments, { komentare: '1' }, true) },
    { label: 'Natočeno (vč. ve střihu a publikovaných)', note: '', ...link((c) => c.shot, { natoceno: '1' }) },
    { label: 'Odloženo / Zrušeno', note: '', ...link((c) => c.postponedOrCancelled, { stav: 'postponed,cancelled' }) },
  ];
}

function HistoryChart({ rows, month }: { rows: HistoryRow[]; month: string }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.plan, r.scripts, r.published]));
  const slot = 20;
  const width = rows.length * slot;
  const height = 120;
  const y = (n: number) => height - (n / max) * height;
  return (
    <figure className="flex flex-col gap-2">
      <svg role="img" aria-label="Graf historie po měsících: plán, scénáře a publikováno" viewBox={`0 0 ${width} ${height + 18}`} className="h-auto w-full">
        {rows.map((r, i) => {
          const x = i * slot;
          return (
            <g key={r.month} opacity={r.month === month ? 1 : 0.8}>
              <title>{`${r.month}: plán ${r.plan}, scénáře ${r.scripts}, publikováno ${r.published}`}</title>
              <rect x={x + 3} y={y(r.scripts)} width={6} height={height - y(r.scripts)} className="fill-lime" />
              <rect x={x + 10} y={y(r.published)} width={6} height={height - y(r.published)} className="fill-ink" />
              {r.month === month && <rect x={x} y={0} width={slot} height={height} className="fill-ink/5" />}
              <text x={x + slot / 2} y={height + 12} textAnchor="middle" fontSize={6} className="fill-text2">
                {r.month.slice(5)}
              </text>
            </g>
          );
        })}
        <line x1={0} x2={width} y1={y(rows[0]?.plan ?? 0)} y2={y(rows[0]?.plan ?? 0)} strokeDasharray="3 3" strokeWidth={1} className="stroke-coral" />
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text2">
        <span><span aria-hidden className="mr-1 inline-block size-3 rounded-sm bg-lime align-middle" />Scénáře (plán. měsíc)</span>
        <span><span aria-hidden className="mr-1 inline-block size-3 rounded-sm bg-ink align-middle" />Publikováno</span>
        <span><span aria-hidden className="mr-1 inline-block h-0 w-4 border-t-2 border-dashed border-coral align-middle" />Plán</span>
      </figcaption>
    </figure>
  );
}

export function OverviewSections({ o }: { o: Overview }) {
  const { month } = o;
  const cyklus = o.cycleId ?? undefined;
  const monthBase: ListQuery = { mesic: month };
  const cycleIndicatorRows = o.cycleStatus ? cycleIndicators(o) : [];
  const history = o.history;
  const hasData = (r: HistoryRow) => r.scripts > 0 || r.published > 0 || r.month === month;

  const catColumns: Column<HistoryRow>[] = [
    { header: 'Měsíc', cell: (r) => r.month },
    { header: 'Plán (ks)', cell: (r) => r.plan, align: 'right' },
    { header: 'Scénáře (plán. měsíc)', cell: (r) => <Count n={r.scripts} query={{ mesic: r.month, aktivni: '1' }} />, align: 'right' },
    { header: 'Schváleno', cell: (r) => <Count n={r.approved} query={{ mesic: r.month, stav: 'approved' }} />, align: 'right' },
    { header: 'Publikováno', cell: (r) => <Count n={r.published} query={{ publikovano: r.month }} />, align: 'right' },
    { header: 'Plnění', cell: (r) => pct(r.fulfilment), align: 'right' },
    ...o.categoryColumns.map((c): Column<HistoryRow> => ({ header: c.label, cell: (r) => <Count n={r.byCategory[c.key] ?? 0} query={{ publikovano: r.month, kategorie: c.key }} />, align: 'right' })),
    ...o.treatmentColumns.map((t): Column<HistoryRow> => ({ header: t.label, cell: (r) => <Count n={r.byTreatment[t.key] ?? 0} query={{ publikovano: r.month, typ: t.key }} />, align: 'right' })),
  ];

  return (
    <div className="flex flex-col gap-4">
      <Section title={`1. Tematický mix – měsíc ${month}`} hint={`${monthLabel(month)}. Plán = kolik videí má vyjít; Publikováno = skutečně zveřejněno v tomto měsíci.`}>
        <MixTable label="Tematický mix" mix={o.categories} base={monthBase} dim="kategorie" publication />
      </Section>
      <Section title={`2. Odborně hodnotná vs. Instagramová videa – měsíc ${month}`}>
        <MixTable label="Typ zpracování" mix={o.treatments} base={monthBase} dim="typ" publication />
      </Section>
      <Section title={`3. Charakter osobních profilů – měsíc ${month}`} hint={`Tolerance ±${o.tolerancePp} p. b. Firemní profil se nevyhodnocuje.`}>
        {o.characters.length === 0 ? <p className="text-text2">Žádné osobní profily.</p> : <DataTable label="Charakter osobních profilů" columns={characterColumns(month)} rows={o.characters} rowKey={(r) => `${r.profileKey}/${r.characterKey}`} />}
      </Section>
      <Section title={o.cycleId ? `4. Stav scénářů a schvalování – cyklus ${o.cycleId}` : '4. Stav scénářů a schvalování'} hint={o.cycle ? `${cycleLabel(o.cycleId!)}: natáčení ${o.cycle.shootDate ?? '–'}${o.cycle.daysToShoot !== null ? ` (za ${o.cycle.daysToShoot} dní)` : ''}, termín schválení ${o.cycle.approvalDeadline ?? '–'}${o.cycle.daysToDeadline !== null ? ` (za ${o.cycle.daysToDeadline} dní)` : ''}.` : undefined}>
        {o.cycleStatus ? (
          <DataTable<Indicator>
            label="Stav scénářů a schvalování"
            columns={[
              { header: 'Ukazatel', cell: (r) => r.label },
              { header: 'Vybraný cyklus', cell: (r) => r.selected, align: 'right' },
              { header: 'Všechny cykly', cell: (r) => r.all, align: 'right' },
              { header: 'Poznámka', cell: (r) => <span className="text-sm text-text2">{r.note}</span> },
            ]}
            rows={cycleIndicatorRows}
            rowKey={(r) => r.label}
          />
        ) : (
          <p className="text-text2">Zatím není žádný natáčecí cyklus.</p>
        )}
      </Section>
      <Section title={o.cycleId ? `5. Tematický mix pro natáčecí cyklus ${o.cycleId}` : '5. Tematický mix pro natáčecí cyklus'} hint={o.cycle ? `Plán ${o.cycle.plan} videí – fáze plánování a schvalování.` : undefined}>
        {o.cycleCategories ? <MixTable label="Tematický mix cyklu" mix={o.cycleCategories} base={{ cyklus }} dim="kategorie" publication={false} /> : <p className="text-text2">Zatím není žádný natáčecí cyklus.</p>}
      </Section>
      <Section title="6. Obsahové série" hint="Všechny kromě uzavřených a zrušených (pozastavené zůstávají vidět).">
        {o.series.length === 0 ? (
          <p className="text-text2">Žádná aktivní série.</p>
        ) : (
          <DataTable
            label="Obsahové série"
            rows={o.series}
            rowKey={(r) => r.id}
            columns={[
              { header: 'Název série', cell: (r) => <Link href={`/serie/${r.code}`} className={cn('underline underline-offset-2', focusRing)}>{r.code} · {r.name}</Link> },
              { header: 'Stav', cell: (r) => SERIES_STATUS_LABELS[r.status as SeriesStatus] ?? r.status },
              { header: 'Garant', cell: (r) => r.guarantor ?? '–' },
              { header: 'Plán dílů', cell: (r) => r.metrics.planned, align: 'right' },
              { header: 'Díly se scénářem', cell: (r) => <Count n={r.metrics.withScript} query={{ serie: r.id, aktivni: '1' }} />, align: 'right' },
              { header: 'Schváleno', cell: (r) => <Count n={r.metrics.approved} query={{ serie: r.id, stav: 'approved' }} />, align: 'right' },
              { header: 'Natočeno', cell: (r) => <Count n={r.metrics.shot} query={{ serie: r.id, natoceno: '1' }} />, align: 'right' },
              { header: 'Publikováno', cell: (r) => <Count n={r.metrics.published} query={{ serie: r.id, vyroba: 'published' }} />, align: 'right' },
              { header: 'Plnění', cell: (r) => `${r.metrics.fulfilmentPct} %`, align: 'right' },
              { header: 'Zbývá dílů', cell: (r) => r.metrics.remaining, align: 'right' },
              { header: 'Otevřené připomínky', cell: (r) => <Count n={r.metrics.openComments} query={{ serie: r.id, komentare: '1' }} danger />, align: 'right' },
            ]}
          />
        )}
      </Section>
      <Section title="7. Historie po měsících" hint="Publikováno = podle skutečného data zveřejnění.">
        <HistoryChart rows={history} month={month} />
        <DataTable label="Historie po měsících" columns={catColumns} rows={history} mobileRows={history.filter(hasData)} rowKey={(r) => r.month} bold={(r) => r.month === month} />
      </Section>
    </div>
  );
}
