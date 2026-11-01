/** Metrics of one publication (24 h or 7 days after publishing), stored as a flat number map. */
export const METRIC_FIELDS = [
  { key: 'views', label: 'Zhlédnutí', integer: true },
  { key: 'reach', label: 'Dosah', integer: true },
  { key: 'skipRate', label: 'Míra přeskočení (%)', integer: false },
  { key: 'avgWatchSec', label: 'Prům. doba přehrání (s)', integer: false },
  { key: 'shares', label: 'Sdílení', integer: true },
  { key: 'saves', label: 'Uložení', integer: true },
  { key: 'comments', label: 'Komentáře', integer: true },
  { key: 'reelFollowers', label: 'Sledující z reelu', integer: true },
  { key: 'profileVisits', label: 'Návštěvy profilu', integer: true },
] as const;

export type MetricKey = (typeof METRIC_FIELDS)[number]['key'];
export type Metrics = Partial<Record<MetricKey, number>>;

export interface MetricRates {
  shareRate: number | null;
  saveRate: number | null;
  commentRate: number | null;
}

/** Share / save / comment rate = count ÷ reach (null without reach or without the count). */
export function metricRates(metrics: Metrics | Record<string, number> | null | undefined): MetricRates {
  const m = (metrics ?? {}) as Metrics;
  const reach = m.reach;
  const rate = (n: number | undefined) => (reach && reach > 0 && typeof n === 'number' ? n / reach : null);
  return { shareRate: rate(m.shares), saveRate: rate(m.saves), commentRate: rate(m.comments) };
}

/** `0.0325` → „3,3 %“. */
export function formatRate(rate: number | null): string {
  if (rate === null) return '—';
  return `${new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 1 }).format(Math.round(rate * 1000) / 10)} %`;
}

export type NormalizedMetrics = { ok: true; metrics: Record<string, number> | null } | { ok: false; message: string };

/** Cleans a metrics form: blank fields are left out, unknown keys dropped, numbers validated (Czech message on failure). */
export function normalizeMetrics(raw: Record<string, unknown> | null | undefined): NormalizedMetrics {
  const out: Record<string, number> = {};
  for (const field of METRIC_FIELDS) {
    const value = raw?.[field.key];
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) continue;
    const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0) return { ok: false, message: `${field.label}: zadej nezáporné číslo.` };
    if (field.integer && !Number.isInteger(n)) return { ok: false, message: `${field.label}: zadej celé číslo.` };
    if (field.key === 'skipRate' && n > 100) return { ok: false, message: 'Míra přeskočení musí být od 0 do 100 %.' };
    out[field.key] = n;
  }
  return { ok: true, metrics: Object.keys(out).length > 0 ? out : null };
}

/** Czech message for an invalid publication link, otherwise null (an empty link is allowed: „Bez odkazu“). */
export function checkPublicationUrl(url: string): string | null {
  if (url === '') return null;
  return /^https?:\/\/\S+$/i.test(url) ? null : 'Odkaz musí začínat http:// nebo https://.';
}

/** Rows grouped per video, only for videos published in more than one distinct variant (the A/B view). */
export function groupVariants<T extends { videoId: string; variant: string }>(rows: readonly T[]): T[][] {
  const byVideo = new Map<string, T[]>();
  for (const row of rows) byVideo.set(row.videoId, [...(byVideo.get(row.videoId) ?? []), row]);
  return [...byVideo.values()].filter((group) => new Set(group.map((r) => r.variant)).size > 1);
}
