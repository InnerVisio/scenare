import { APPROVAL_STATUSES, isAwaitingDecision, type ApprovalStatus } from '@/domain/workflow/approval';
import { PRODUCTION_STATUSES } from '@/domain/workflow/production';
import { isMonthKey } from '@/ui/monthParams';

export type RowTone = 'coral' | 'apricot' | 'lime' | null;

const UNDECIDED_BY_DEADLINE: ReadonlySet<ApprovalStatus> = new Set(['approved', 'postponed', 'cancelled']);

/**
 * Colour of a list row's left stripe: coral for a returned script or one past its due day (and still
 * not approved, postponed or cancelled), apricot while leaders decide, lime when approved.
 * `today` is the Prague date, `YYYY-MM-DD`.
 */
export function rowTone(item: { approvalStatus: ApprovalStatus; scriptDueDate: string | null }, today: string): RowTone {
  const overdue = item.scriptDueDate !== null && item.scriptDueDate < today && !UNDECIDED_BY_DEADLINE.has(item.approvalStatus);
  if (item.approvalStatus === 'returned' || overdue) return 'coral';
  if (isAwaitingDecision(item.approvalStatus)) return 'apricot';
  if (item.approvalStatus === 'approved') return 'lime';
  return null;
}

export interface ListQuery {
  cyklus?: string;
  mesic?: string;
  kategorie?: string;
  stav?: string;
  vyroba?: string;
  serie?: string;
  q?: string;
}

type RawQuery = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** URL query → only the filters that name something that exists; anything else is ignored. */
export function parseListQuery(
  raw: RawQuery,
  known: { cycleIds: string[]; categoryKeys: string[]; seriesIds: string[] },
): ListQuery {
  const out: ListQuery = {};
  const cyklus = first(raw.cyklus);
  const mesic = first(raw.mesic);
  const kategorie = first(raw.kategorie);
  const stav = first(raw.stav);
  const vyroba = first(raw.vyroba);
  const serie = first(raw.serie);
  const q = first(raw.q)?.trim();
  if (cyklus && known.cycleIds.includes(cyklus)) out.cyklus = cyklus;
  if (isMonthKey(mesic)) out.mesic = mesic;
  if (kategorie && known.categoryKeys.includes(kategorie)) out.kategorie = kategorie;
  if (stav && (APPROVAL_STATUSES as readonly string[]).includes(stav)) out.stav = stav;
  if (vyroba && (PRODUCTION_STATUSES as readonly string[]).includes(vyroba)) out.vyroba = vyroba;
  if (serie && known.seriesIds.includes(serie)) out.serie = serie;
  if (q) out.q = q;
  return out;
}

const ORDER: (keyof ListQuery)[] = ['cyklus', 'mesic', 'kategorie', 'stav', 'vyroba', 'serie', 'q'];

export function toListHref(query: ListQuery): string {
  const params = new URLSearchParams();
  for (const key of ORDER) if (query[key]) params.set(key, query[key]!);
  const qs = params.toString();
  return qs ? `/scenare?${qs}` : '/scenare';
}
