const pragueHour = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Prague', hour: 'numeric', hourCycle: 'h23' });
const longDate = new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague', weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' });
const weekday = new Intl.DateTimeFormat('cs-CZ', { timeZone: 'Europe/Prague', weekday: 'long' });

/** Czech plural for 1 / 2–4 / 5+ (and 0). */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  if (abs === 1) return one;
  return abs >= 2 && abs <= 4 ? few : many;
}

export const daysLabel = (n: number) => `${n} ${plural(n, 'den', 'dny', 'dní')}`;
export const scriptsLabel = (n: number) => plural(n, 'scénář', 'scénáře', 'scénářů');

/** „Dobré ráno“ 5–11, „Dobré odpoledne“ 11–18, otherwise „Dobrý večer“ (Prague hour). */
export function greeting(now: Date, name: string): string {
  const hour = Number(pragueHour.format(now));
  const part = hour >= 5 && hour < 11 ? 'Dobré ráno' : hour >= 11 && hour < 18 ? 'Dobré odpoledne' : 'Dobrý večer';
  return `${part}, ${name}`;
}

/** „Čtvrtek 29. 10. 2026 · do natáčení zbývá 22 dní“ */
export function dateLine(now: Date, daysToShoot: number | null): string {
  const parts = longDate.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const day = get('weekday');
  const head = `${day.charAt(0).toUpperCase()}${day.slice(1)} ${get('day')}. ${get('month')}. ${get('year')}`;
  if (daysToShoot === null || daysToShoot < 0) return head;
  if (daysToShoot === 0) return `${head} · natáčí se dnes`;
  return `${head} · do natáčení ${plural(daysToShoot, 'zbývá', 'zbývají', 'zbývá')} ${daysLabel(daysToShoot)}`;
}

/** Weekday name of a `YYYY-MM-DD` date, lowercase („pátek“). */
export function weekdayOf(iso: string): string {
  return weekday.format(new Date(`${iso}T12:00:00Z`));
}

/** `2026-11-20` → `20. 11.` */
export function dayMonth(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(d)}. ${Number(m)}.`;
}

/** „za 15 dní“, „dnes“, „před 2 dny“ */
export function inDays(n: number): string {
  if (n === 0) return 'dnes';
  return n > 0 ? `za ${daysLabel(n)}` : `před ${daysLabel(-n)}`;
}
