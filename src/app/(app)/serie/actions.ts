'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { ActionResult } from '@/server/actionResult';
import { closeSeries, createEpisode, createSeries, updateSeries } from '@/server/series';
import { runAction } from '../_actions/run';

const id = z.string().min(1).max(64);
const text = (max: number) => z.string().max(max);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

const patchSchema = z.object({
  seriesId: id,
  patch: z
    .object({
      name: text(200),
      mainCategoryKey: z.string().max(64).nullable(),
      goal: text(2000),
      guarantorId: z.string().max(64).nullable(),
      plannedEpisodes: z.number().int().min(1).max(200).nullable(),
      scopeChangeReason: text(1000),
      startDate: date,
      expectedEnd: date,
      note: text(2000),
      status: text(32),
    })
    .partial(),
});
const seriesIdSchema = z.object({ seriesId: id });

export async function updateSeriesAction(input: z.input<typeof patchSchema>): Promise<ActionResult> {
  return runAction(input, patchSchema, (db, actor, i, now) => updateSeries(db, actor, i.seriesId, i.patch, now));
}

export async function closeSeriesAction(input: z.input<typeof seriesIdSchema>): Promise<ActionResult> {
  return runAction(input, seriesIdSchema, (db, actor, i, now) => closeSeries(db, actor, i.seriesId, now));
}

/** „+ Nová série“ as a form action: creates the series under the next code and opens its detail for editing. */
export async function createSeriesAction(): Promise<void> {
  const result = await runAction({}, z.object({}), async (db, actor, _i, now) => {
    const { code } = await createSeries(db, actor, { name: 'Nová série' }, now);
    return { code };
  });
  if (!result.ok) throw new Error(result.message);
  redirect(`/serie/${result.code}`);
}

/** „+ Nový díl“ as a form action: creates the episode draft and opens it in the editor. */
export async function createEpisodeAction(input: z.input<typeof seriesIdSchema>): Promise<void> {
  const result = await runAction(input, seriesIdSchema, async (db, actor, i, now) => {
    const { code } = await createEpisode(db, actor, i.seriesId, now);
    return { code };
  });
  if (!result.ok) throw new Error(result.message);
  redirect(`/scenare/${result.code}/upravit`);
}
