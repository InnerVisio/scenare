import { sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import * as s from '@/db/schema';
import type { Role } from '@/domain/policy/can';
import type { Actor } from './actor';
import { loadNotificationFeed, queueCountSql, type NotificationItem } from './queries';

export interface ShellData {
  user: { name: string; initials: string; role: Role };
  unread: number;
  /** Latest notifications for the bell. */
  notifications: NotificationItem[];
  /** Review-queue items the actor has not approved yet (leadership only, otherwise 0). */
  queueCount: number;
  cycleIds: string[];
  /** Cycle shown when the URL has no `cyklus`: the next shoot, else the latest cycle. */
  defaultCycleId: string | null;
  /** Current month in Prague, `YYYY-MM`. */
  currentMonth: string;
}

const pragueDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Prague',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Layout data in two queries: cycles + sidebar badge together, notifications (with unread count) together. */
export async function loadShellData(db: Db, actor: Actor, now: Date): Promise<ShellData> {
  const today = pragueDay.format(now);
  const [[head], feed] = await Promise.all([
    db
      .select({
        ids: sql<string[] | null>`array_agg(${s.shootingCycles.id} order by ${s.shootingCycles.shootDate}, ${s.shootingCycles.id})`,
        dates: sql<(string | null)[] | null>`array_agg(${s.shootingCycles.shootDate}::text order by ${s.shootingCycles.shootDate}, ${s.shootingCycles.id})`,
        queueCount: actor.role === 'leadership' ? queueCountSql(actor.id) : sql<number>`0`,
      })
      .from(s.shootingCycles),
    loadNotificationFeed(db, actor, { limit: 10 }),
  ]);
  const ids = head.ids ?? [];
  const dates = head.dates ?? [];
  const upcoming = ids.findIndex((_, i) => dates[i] !== null && dates[i] !== undefined && dates[i]! >= today);
  const latest = [...ids].sort((a, b) => b.localeCompare(a))[0];
  return {
    user: { name: actor.name, initials: actor.initials ?? actor.name.charAt(0), role: actor.role },
    unread: feed.unread,
    notifications: feed.items,
    queueCount: head.queueCount,
    cycleIds: ids,
    defaultCycleId: (upcoming >= 0 ? ids[upcoming] : latest) ?? null,
    currentMonth: today.slice(0, 7),
  };
}
