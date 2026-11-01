const TIME_ZONE = 'Europe/Prague';

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function pragueParts(d: Date): { y: number; mo: number; d: number; h: number; mi: number } {
  const p: Record<string, number> = {};
  for (const part of partsFormatter.formatToParts(d)) if (part.type !== 'literal') p[part.type] = Number(part.value);
  return { y: p.year, mo: p.month, d: p.day, h: p.hour, mi: p.minute };
}

/** Prague wall-clock minus UTC at instant `ts`, in ms. */
function offsetAt(ts: number): number {
  const p = pragueParts(new Date(ts));
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) - Math.floor(ts / 60_000) * 60_000;
}

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** `YYYY-MM-DDTHH:mm` typed in Prague time (a `datetime-local` value) → the instant; any other ISO string is parsed as is. Null when invalid. */
export function parsePragueDateTime(value: string): Date | null {
  const m = LOCAL.exec(value);
  if (!m) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const first = wall - offsetAt(wall);
  const result = wall - offsetAt(first);
  const date = new Date(result);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** The instant as a `datetime-local` value in Prague time. */
export function toPragueDateTimeInput(d: Date): string {
  const p = pragueParts(d);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${p.y}-${two(p.mo)}-${two(p.d)}T${two(p.h)}:${two(p.mi)}`;
}
