import { asc, eq } from 'drizzle-orm';
import type { Db } from '@/db/client';
import * as s from '@/db/schema';
import type { Role } from '@/domain/policy/can';
import type { Actor } from './actor';
import { getReviewQueue, unreadCount } from './queries';

export interface ShellData {
  user: { name: string; initials: string; role: Role };
  unread: number;
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

export async function loadShellData(db: Db, actor: Actor, now: Date): Promise<ShellData> {
  const today = pragueDay.format(now);
  const [[user], unread, queue, cycles] = await Promise.all([
    db.select().from(s.users).where(eq(s.users.id, actor.id)),
    unreadCount(db, actor),
    actor.role === 'leadership' ? getReviewQueue(db, actor, {}) : Promise.resolve([]),
    db.select().from(s.shootingCycles).orderBy(asc(s.shootingCycles.shootDate), asc(s.shootingCycles.id)),
  ]);
  const upcoming = cycles.find((c) => c.shootDate !== null && c.shootDate >= today);
  const latest = [...cycles].sort((a, b) => b.id.localeCompare(a.id))[0];
  return {
    user: { name: actor.name, initials: user?.initials ?? actor.name.charAt(0), role: actor.role },
    unread,
    queueCount: queue.filter((item) => !item.decidedByActor).length,
    cycleIds: cycles.map((c) => c.id),
    defaultCycleId: (upcoming ?? latest)?.id ?? null,
    currentMonth: today.slice(0, 7),
  };
}
