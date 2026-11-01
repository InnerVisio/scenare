'use server';

import { z } from 'zod';
import type { ActionResult } from '@/server/actionResult';
import { authSecret } from '@/server/auth/jwt';
import { createCrewLink, setProductionStatus } from '@/server/shooting';
import { runAction } from '../_actions/run';

const id = z.string().min(1).max(64);

const statusSchema = z.object({
  videoIds: z.array(id).min(1).max(200),
  status: z.string().min(1).max(32),
  shotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function setProductionStatusAction(input: z.input<typeof statusSchema>): Promise<ActionResult> {
  return runAction(input, statusSchema, (db, actor, i, now) => setProductionStatus(db, actor, i, now));
}

/** „Sdílet se štábem“: the path of the crew page (the browser adds its own origin). */
export async function createCrewLinkAction(input: { cycleId: string }): Promise<ActionResult<{ path: string }>> {
  return runAction(input, z.object({ cycleId: id }), async (db, actor, i, now) => {
    const { token } = await createCrewLink(db, actor, i.cycleId, authSecret(), now);
    return { path: `/stab/${token}` };
  }, { revalidate: false });
}
