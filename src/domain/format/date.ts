const TIME_ZONE = 'Europe/Prague';

const dateFormatter = new Intl.DateTimeFormat('cs-CZ', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('cs-CZ', {
  timeZone: TIME_ZONE,
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function parts(formatter: Intl.DateTimeFormat, d: Date): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of formatter.formatToParts(d)) out[p.type] = p.value;
  return out;
}

/** "29. 10. 2026" in Europe/Prague. */
export function formatDate(d: Date): string {
  const p = parts(dateFormatter, d);
  return `${p.day}. ${p.month}. ${p.year}`;
}

/** "29. 10. 2026 21:40" in Europe/Prague (24h). */
export function formatDateTime(d: Date): string {
  const p = parts(dateTimeFormatter, d);
  return `${p.day}. ${p.month}. ${p.year} ${p.hour}:${p.minute}`;
}

/** Days from the Prague-local date of `now` to the Prague-local date of `target` (negative if past). */
export function daysUntil(target: Date, now: Date): number {
  const t = parts(dateFormatter, target);
  const n = parts(dateFormatter, now);
  const targetDay = Date.UTC(Number(t.year), Number(t.month) - 1, Number(t.day));
  const nowDay = Date.UTC(Number(n.year), Number(n.month) - 1, Number(n.day));
  return Math.round((targetDay - nowDay) / 86_400_000);
}

const dayMonthFormatter = new Intl.DateTimeFormat('cs-CZ', { timeZone: TIME_ZONE, day: 'numeric', month: 'numeric' });
const timeFormatter = new Intl.DateTimeFormat('cs-CZ', {
  timeZone: TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** "20. 11." in Europe/Prague. */
export function formatDayMonth(d: Date): string {
  const p = parts(dayMonthFormatter, d);
  return `${p.day}. ${p.month}.`;
}

/** "7:12" (24h, hour without a leading zero) in Europe/Prague. */
export function formatTime(d: Date): string {
  const p = parts(timeFormatter, d);
  return `${p.hour}:${p.minute}`;
}

/**
 * Comment timestamps: "dnes 7:12", "včera 21:40", otherwise "28. 10. 21:40" (with the year when it
 * is not the current one). `now` is passed in so server and client render the same text.
 */
export function formatRelative(d: Date, now: Date): string {
  const days = daysUntil(now, d);
  const time = formatTime(d);
  if (days === 0) return `dnes ${time}`;
  if (days === 1) return `včera ${time}`;
  const p = parts(dateFormatter, d);
  const sameYear = p.year === parts(dateFormatter, now).year;
  return `${p.day}. ${p.month}. ${sameYear ? '' : `${p.year} `}${time}`;
}

const isoDayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

/** "2026-10-29": the Prague calendar day of `d`, comparable with `YYYY-MM-DD` database dates. */
export function pragueDay(d: Date): string {
  return isoDayFormatter.format(d);
}
