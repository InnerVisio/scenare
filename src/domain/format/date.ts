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

const hourFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', hourCycle: 'h23' });

/** Hour of the day (0–23) in Europe/Prague. */
export function pragueHour(d: Date): number {
  return Number(parts(hourFormatter, d).hour);
}

const WEEKDAYS_SHORT = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'];
const WEEKDAYS_LONG = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];
const dayParts = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return { m, d, weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
};

/** `2026-11-20` → "20. 11." */
export const dayMonthOf = (day: string) => {
  const { m, d } = dayParts(day);
  return `${d}. ${m}.`;
};
/** `2026-11-20` → "čt 20. 11." */
export const weekdayShortDate = (day: string) => `${WEEKDAYS_SHORT[dayParts(day).weekday]} ${dayMonthOf(day)}`;
/** `2026-11-20` → "pá 20. 11. 2026" */
export const weekdayShortDateYear = (day: string) => `${weekdayShortDate(day)} ${day.slice(0, 4)}`;
/** `2026-11-20` → "čtvrtek 20. 11." */
export const weekdayLongDate = (day: string) => `${WEEKDAYS_LONG[dayParts(day).weekday]} ${dayMonthOf(day)}`;

/** "1 den", "5 dní". */
export const daysWord = (n: number) => `${n} ${n === 1 ? 'den' : n >= 2 && n <= 4 ? 'dny' : 'dní'}`;

/** Shooting cycle as users see it: "Natáčení 20. 11. (čt)" or "Natáčení 2026-11 · bez data". */
export function cycleLabel(cycle: { id: string; shootDate: string | null }): string {
  if (!cycle.shootDate) return `Natáčení ${cycle.id} · bez data`;
  const { weekday } = dayParts(cycle.shootDate);
  return `Natáčení ${dayMonthOf(cycle.shootDate)} (${WEEKDAYS_SHORT[weekday]})`;
}

/** "čt 20. 11. · zbývá 5 dní" (`now` decides the countdown). */
export function shootDayLabel(shootDate: string, now: Date): string {
  const n = daysUntil(new Date(`${shootDate}T12:00:00Z`), now);
  const tail = n > 0 ? `zbývá ${daysWord(n)}` : n === 0 ? 'dnes' : 'už proběhlo';
  return `${weekdayShortDate(shootDate)} · ${tail}`;
}
