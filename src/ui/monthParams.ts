const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export const isMonthKey = (value: string | null | undefined): value is string => !!value && MONTH_PATTERN.test(value);

/** `?mesic=` value if it is a valid `YYYY-MM`, otherwise the fallback. */
export function parseMonthParam(value: string | null | undefined, fallback: string): string {
  return isMonthKey(value) ? value : fallback;
}

/** `?cyklus=` value if it is a valid `YYYY-MM` AND a known cycle id, otherwise the fallback. */
export function parseCycleParam(
  value: string | null | undefined,
  knownIds: readonly string[],
  fallback: string | null,
): string | null {
  return isMonthKey(value) && knownIds.includes(value) ? value : fallback;
}

const monthFormatter = new Intl.DateTimeFormat('cs-CZ', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** `2026-11` → „Listopad 2026“. */
export function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number);
  const text = monthFormatter.format(new Date(Date.UTC(year, m - 1, 15)));
  return text.charAt(0).toLocaleUpperCase('cs') + text.slice(1);
}

/** `2026-11` → „Cyklus 2026–11“ (en dash). */
export const cycleLabel = (id: string) => `Cyklus ${id.replace('-', '–')}`;

/** `current` ± `radius` months, as `YYYY-MM`. */
export function monthsAround(current: string, radius = 6): string[] {
  const [year, m] = current.split('-').map(Number);
  return Array.from({ length: radius * 2 + 1 }, (_, i) => {
    const d = new Date(Date.UTC(year, m - 1 + i - radius, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}
