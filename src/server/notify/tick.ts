import type { Db } from '@/db/client';
import { sendDailyIfDue } from './daily';
import { sendDigests } from './digest';

export interface TickSummary {
  digests: number;
  daily: number;
  reminders: number;
}

/** One scheduler run (GitHub Actions calls it every 15 minutes): digests first, then the daily summary. */
export async function runTick(db: Db, now: Date): Promise<TickSummary> {
  const digests = await sendDigests(db, now);
  const daily = await sendDailyIfDue(db, now);
  return { digests, daily: daily.sent, reminders: daily.reminders };
}
