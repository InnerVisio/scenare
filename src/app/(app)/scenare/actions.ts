'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import type { ActionResult } from '@/server/actionResult';
import { parseScriptsText, type ParsedScript } from '@/server/scriptImport';
import { addReference, removeReference } from '@/server/references';
import { appUrl } from '@/server/appUrl';
import { eq } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { moveToShootingDay, deleteManyVideos, deleteVideo, type BulkDeleteResult, duplicateAsEpisode, createVideo, saveDraft, setLifecycle, submitForReview, submitManyForReview, type BulkSubmitResult, unlockForEdit, updateVideoMeta, withdrawFromReview, withdrawManyFromReview, type BulkWithdrawResult } from '@/server/videos';
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

export async function submitForReviewAction(
  input: z.input<typeof submitSchema>,
): Promise<ActionResult<{ versionNo: number; title: string; shareUrl: string | null }>> {
  return runAction(input, submitSchema, async (db, actor, i, now) => {
    const { versionNo } = await submitForReview(db, actor, i.videoId, { changeSummary: i.changeSummary }, now);
    const [row] = await db.select({ title: schema.videos.title }).from(schema.videos).where(eq(schema.videos.id, i.videoId));
    return { versionNo, title: row?.title ?? '', shareUrl: appUrl() };
  });
}

const bulkSchema = z.object({ videoIds: z.array(id).min(1).max(50) });

/** Bulk „Odeslat ke kontrole“ from the list: per-script failures come back as Czech messages. */
export async function bulkSubmitAction(input: z.input<typeof bulkSchema>): Promise<ActionResult<BulkSubmitResult & { shareUrl: string | null }>> {
  return runAction(input, bulkSchema, async (db, actor, i, now) => ({ ...(await submitManyForReview(db, actor, i.videoIds, now)), shareUrl: appUrl() }));
}

export async function deleteScriptAction(input: z.input<typeof videoIdSchema>): Promise<ActionResult> {
  return runAction(input, videoIdSchema, (db, actor, i, now) => deleteVideo(db, actor, i.videoId, now));
}

export async function bulkDeleteAction(input: z.input<typeof bulkSchema>): Promise<ActionResult<BulkDeleteResult>> {
  return runAction(input, bulkSchema, (db, actor, i, now) => deleteManyVideos(db, actor, i.videoIds, now));
}

const moveSchema = z.object({ videoIds: z.array(id).min(1).max(50), cycleId: id.nullable() });

export async function moveToShootingDayAction(input: z.input<typeof moveSchema>): Promise<ActionResult> {
  return runAction(input, moveSchema, (db, actor, i, now) => moveToShootingDay(db, actor, i.videoIds, i.cycleId, now));
}

export async function withdrawScriptAction(input: z.input<typeof videoIdSchema>): Promise<ActionResult> {
  return runAction(input, videoIdSchema, (db, actor, i, now) => withdrawFromReview(db, actor, i.videoId, now));
}

export async function bulkWithdrawAction(input: z.input<typeof bulkSchema>): Promise<ActionResult<BulkWithdrawResult>> {
  return runAction(input, bulkSchema, (db, actor, i, now) => withdrawManyFromReview(db, actor, i.videoIds, now));
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

const parseSchema = z.object({ text: z.string().max(40_000) });
const importSchema = z.object({
  cycleId: nullableKey,
  plannedMonth: prefillSchema.shape.plannedMonth,
  submit: z.boolean().optional(),
  scripts: z.array(z.object({ meta: metaSchema.required({ title: true }), body: bodySchema })).min(1).max(20),
});

/** „Rozdělit scénář“: nothing is saved, the preview comes back. */
export async function parseScriptsAction(input: z.input<typeof parseSchema>): Promise<ActionResult<{ scripts: ParsedScript[] }>> {
  return runAction(input, parseSchema, async (db, actor, i) => ({ scripts: await parseScriptsText(db, actor, i.text) }), { revalidate: false });
}

/** „Uložit všechny“: one draft per previewed script. */
export async function importScriptsAction(
  input: z.input<typeof importSchema>,
): Promise<ActionResult<{ codes: string[]; submitted: BulkSubmitResult['submitted']; failed: string[]; shareUrl: string | null }>> {
  return runAction(input, importSchema, async (db, actor, i, now) => {
    const codes: string[] = [];
    const ids: string[] = [];
    for (const script of i.scripts) {
      const { id, code } = await createVideo(
        db,
        actor,
        { ...script.meta, title: script.meta.title, cycleId: i.cycleId, plannedMonth: i.plannedMonth ?? null },
        now,
      );
      await saveDraft(db, actor, id, script.body, now);
      codes.push(code);
      ids.push(id);
    }
    const sent = i.submit ? await submitManyForReview(db, actor, ids, now) : { submitted: [], failed: [] };
    return { codes, ...sent, shareUrl: appUrl() };
  });
}

const addReferenceSchema = z.object({
  videoId: id,
  url: text(2000),
  note: text(2000).optional(),
  sceneId: id.nullable().optional(),
});
const removeReferenceSchema = z.object({ videoId: id, referenceId: id });

export async function addReferenceAction(input: z.input<typeof addReferenceSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(input, addReferenceSchema, (db, actor, i, now) => addReference(db, actor, i, now));
}

export async function removeReferenceAction(input: z.input<typeof removeReferenceSchema>): Promise<ActionResult> {
  return runAction(input, removeReferenceSchema, (db, actor, i, now) => removeReference(db, actor, i, now));
}
