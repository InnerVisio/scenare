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
