'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { ActionResult } from '@/server/actionResult';
import { duplicateAsEpisode, createVideo, saveDraft, setLifecycle, submitForReview, unlockForEdit, updateVideoMeta } from '@/server/videos';
import { runAction } from '../_actions/run';

// Thin wrappers around the use cases, like the review actions. Autosave writes (draft and meta) skip
// the cache refresh so the editor is not re-rendered under the author's hands.

const id = z.string().min(1).max(64);
const text = (max: number) => z.string().max(max);
const seconds = z.number().int().min(0).max(600).nullable();

const bodySchema = z.object({
  hooks: z
    .array(z.object({ id: z.enum(['A', 'B', 'C']), hookType: z.string().max(64).nullable(), text: text(1000), visual: text(1000) }))
    .max(3),
  scenes: z
    .array(
      z.object({
        id,
        fromSec: seconds,
        toSec: seconds,
        visual: text(2000),
        lines: z.array(z.object({ id, speaker: text(80), direction: text(120), text: text(2000) })).max(40),
      }),
    )
    .max(12),
  cta: z.object({ lineId: id, ctaType: z.enum(['share', 'save', 'question']) }).nullable(),
  caption: text(2200),
  hashtags: z.array(text(60)).max(30),
  viewerLearns: text(1000),
  source: text(1000),
  differsFromLast3: text(1000),
});

const nullableKey = z.string().max(64).nullable();
const metaSchema = z
  .object({
    title: text(200),
    seriesId: nullableKey,
    episodeNo: z.number().int().min(1).max(999).nullable(),
    cycleId: nullableKey,
    plannedMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable(),
    categoryKey: nullableKey,
    treatmentKey: nullableKey,
    profileKey: nullableKey,
    characterKey: nullableKey,
    goalMetric: z.enum(['shares', 'saves', 'comments']).nullable(),
    formatKey: nullableKey,
    isTrialReel: z.boolean(),
    locationKeys: z.array(z.string().max(64)).max(20),
    cast: z.array(text(80)).max(20),
    props: text(1000),
    intent: text(1000),
    mainIdea: text(1000),
  })
  .partial();

const saveDraftSchema = z.object({ videoId: id, body: bodySchema });
const metaPatchSchema = z.object({ videoId: id, patch: metaSchema });
const submitSchema = z.object({ videoId: id, changeSummary: text(500).optional() });
const videoIdSchema = z.object({ videoId: id });
const lifecycleSchema = z.object({ videoId: id, action: z.enum(['postpone', 'cancel', 'restore']), reason: text(500).optional() });
const prefillSchema = z.object({ cycleId: nullableKey.optional(), plannedMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable().optional() });

export async function saveDraftAction(input: z.input<typeof saveDraftSchema>): Promise<ActionResult> {
  return runAction(input, saveDraftSchema, (db, actor, i, now) => saveDraft(db, actor, i.videoId, i.body, now), { revalidate: false });
}

export async function updateVideoMetaAction(input: z.input<typeof metaPatchSchema>): Promise<ActionResult> {
  return runAction(input, metaPatchSchema, (db, actor, i, now) => updateVideoMeta(db, actor, i.videoId, i.patch, now), { revalidate: false });
}

export async function submitForReviewAction(input: z.input<typeof submitSchema>): Promise<ActionResult<{ versionNo: number }>> {
  return runAction(input, submitSchema, async (db, actor, i, now) => {
    const { versionNo } = await submitForReview(db, actor, i.videoId, { changeSummary: i.changeSummary }, now);
    return { versionNo };
  });
}

export async function unlockScriptAction(input: z.input<typeof videoIdSchema>): Promise<ActionResult> {
  return runAction(input, videoIdSchema, (db, actor, i, now) => unlockForEdit(db, actor, i.videoId, now));
}

export async function lifecycleAction(input: z.input<typeof lifecycleSchema>): Promise<ActionResult> {
  return runAction(input, lifecycleSchema, (db, actor, i, now) =>
    setLifecycle(db, actor, i.videoId, { action: i.action, reason: i.reason ?? '' }, now),
  );
}

export async function duplicateEpisodeAction(input: z.input<typeof videoIdSchema>): Promise<ActionResult<{ code: string }>> {
  return runAction(input, videoIdSchema, async (db, actor, i, now) => {
    const { code } = await duplicateAsEpisode(db, actor, i.videoId, now);
    return { code };
  });
}

/** „+ Nový scénář“ as a form action: creates an empty draft (keeping the list's cycle and month) and opens the editor. */
export async function createScriptAction(prefill: z.input<typeof prefillSchema>): Promise<void> {
  const result = await runAction(prefill, prefillSchema, async (db, actor, i, now) => {
    const { code } = await createVideo(
      db,
      actor,
      { title: 'Nový scénář', ...(i.cycleId ? { cycleId: i.cycleId } : {}), ...(i.plannedMonth ? { plannedMonth: i.plannedMonth } : {}) },
      now,
    );
    return { code };
  });
  if (!result.ok) throw new Error(result.message);
  redirect(`/scenare/${result.code}/upravit`);
}
