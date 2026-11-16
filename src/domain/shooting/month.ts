// Month of a script and „next shooting day“ picking. Pure: no clock, no I/O.

interface DatedCycle {
  id: string;
  shootDate: string | null;
}

/** Cycles by shootDate ascending (no date last), ties by id. The DB order is not guaranteed, so sort before picking. */
export function sortCycles<C extends DatedCycle>(cycles: readonly C[]): C[] {
  return [...cycles].sort((a, b) => (a.shootDate ?? '9999-99-99').localeCompare(b.shootDate ?? '9999-99-99') || a.id.localeCompare(b.id));
}

/** The earliest shooting day on or after `today` (`YYYY-MM-DD`), whatever the input order. */
export function nextShootingDay<C extends DatedCycle>(cycles: readonly C[], today: string): C | undefined {
  return sortCycles(cycles).find((c) => c.shootDate !== null && c.shootDate >= today);
}

/** `YYYY-MM`: month of the script's shooting day, else its planned month, else null. */
export function scriptMonth(shootDate: string | null | undefined, plannedMonth: string | null | undefined): string | null {
  return shootDate?.slice(0, 7) || plannedMonth || null;
}
