import { revalidatePath } from 'next/cache';
import type { z } from 'zod';
import { getDb } from '@/db/client';
import { toActionResult, type ActionResult } from '@/server/actionResult';
import { requireActor } from '@/server/auth/session';

type Db = Awaited<ReturnType<typeof getDb>>;
type CurrentActor = Awaited<ReturnType<typeof requireActor>>;

/**
 * Shared body of the thin server actions: authenticate, validate with `schema`, run the use case with
 * the current time, refresh the cached pages and return a plain result (never throw for expected
 * business failures). Autosave style actions pass `revalidate: false`.
 */
export async function runAction<I, T extends object>(
  input: unknown,
  schema: z.ZodType<I>,
  use: (db: Db, actor: CurrentActor, input: I, now: Date) => Promise<T | void>,
  options: { revalidate?: boolean } = {},
): Promise<ActionResult<T>> {
  const actor = await requireActor();
  const result = await toActionResult<T>(async () => use(await getDb(), actor, schema.parse(input), new Date()));
  if (result.ok && options.revalidate !== false) revalidatePath('/', 'layout');
  return result;
}
