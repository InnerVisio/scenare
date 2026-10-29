'use server';

import { z } from 'zod';
import { markNotificationRead } from '@/server/queries';
import { runAction } from '../_actions/run';

export async function markRead(id: string) {
  return runAction({ id }, z.object({ id: z.string().min(1).max(64) }), (db, actor, input, now) =>
    markNotificationRead(db, actor, input.id, now),
  );
}
