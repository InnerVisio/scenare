import { and, eq, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import * as s from '@/db/schema';
import { remapAnchor } from '@/domain/anchors/remap';
import { newId } from '@/domain/ids';
import { can } from '@/domain/policy/can';
import { emptyScript } from '@/domain/script/template';
import type { ScriptBody } from '@/domain/script/types';
import { canSubmit, statusAfterSubmit } from '@/domain/workflow/approval';
import { logActivity } from './activity';
import type { Actor } from './actor';
import { loadRules } from './checkContext';
import { DomainError } from './errors';
import { latestVersion, loadVideo, statusOf, type Tx, type VideoRow } from './loaders';

/** Editable script metadata. Approval state is deliberately not part of it. */
export interface VideoMetaPatch {
  title?: string;
  seriesId?: string | null;
  episodeNo?: number | null;
  cycleId?: string | null;
  plannedMonth?: string | null;
  categoryKey?: string | null;
  treatmentKey?: string | null;
  profileKey?: string | null;
  characterKey?: string | null;
  contentType?: string | null;
  intent?: string;
  goalMetric?: 'shares' | 'saves' | 'comments' | null;
  mainIdea?: string;
  formatKey?: string | null;
  isTrialReel?: boolean;
  locationKeys?: string[];
  cast?: string[];
  props?: string;
  scriptDueDate?: string | null;
  marketerNote?: string;
}

const META_KEYS = [
  'title',
  'seriesId',
  'episodeNo',
  'cycleId',
  'plannedMonth',
  'categoryKey',
  'treatmentKey',
  'profileKey',
  'characterKey',
  'contentType',
  'intent',
  'goalMetric',
  'mainIdea',
  'formatKey',
  'isTrialReel',
  'locationKeys',
  'cast',
  'props',
  'scriptDueDate',
  'marketerNote',
] as const satisfies readonly (keyof VideoMetaPatch & keyof VideoRow)[];

const VERSION_META_KEYS = [
  'title',
  'categoryKey',
  'treatmentKey',
  'profileKey',
  'characterKey',
  'formatKey',
  'goalMetric',
  'isTrialReel',
  'locationKeys',
  'cast',
  'seriesId',
  'episodeNo',
  'cycleId',
  'plannedMonth',
] as const satisfies readonly (keyof VideoRow)[];

export function snapshotMeta(video: VideoRow): Record<string, unknown> {
  return Object.fromEntries(VERSION_META_KEYS.map((key) => [key, video[key]]));
}

const forbidden = () => new DomainError('FORBIDDEN', 'K této akci nemáš oprávnění.');

function pickMeta(patch: VideoMetaPatch): Partial<VideoMetaPatch> {
  const out: Record<string, unknown> = {};
  for (const key of META_KEYS) if (Object.hasOwn(patch, key) && patch[key] !== undefined) out[key] = patch[key];
  return out as Partial<VideoMetaPatch>;
}

function requireTitle(title: string | undefined): string {
  const trimmed = title?.trim() ?? '';
  if (!trimmed) throw new DomainError('VALIDATION', 'Zadej název scénáře.');
  return trimmed;
}

function nextCode(codes: string[]): string {
  const max = codes.reduce((m, code) => {
    const match = /^V(\d+)$/.exec(code);
    return match ? Math.max(m, Number(match[1])) : m;
  }, 0);
  return `V${String(max + 1).padStart(3, '0')}`;
}

/** Inserts a draft owned by `actor` under the next free code; the caller has already checked permissions. */
async function insertDraft(
  tx: Tx,
  actor: Actor,
  values: Omit<typeof s.videos.$inferInsert, 'id' | 'code' | 'ownerId' | 'draft' | 'approvalStatus' | 'productionStatus'>,
  draft: ScriptBody,
  logExtra: Record<string, unknown>,
  now: Date,
): Promise<{ id: string; code: string }> {
  // Serialise code allocation across concurrent creators.
  await tx.execute(sql`select pg_advisory_xact_lock(${7_100_001})`);
  const codes = (await tx.select({ code: s.videos.code }).from(s.videos)).map((r) => r.code);
  const code = nextCode(codes);
  const id = newId();
  await tx.insert(s.videos).values({
    ...values,
    id,
    code,
    approvalStatus: 'draft',
    productionStatus: 'waiting',
    ownerId: actor.id,
    draft,
    createdAt: now,
    updatedAt: now,
  });
  await logActivity(
    tx,
    {
      actorId: actor.id,
      videoId: id,
      entity: 'video',
      entityId: id,
      action: 'video.created',
      after: { code, status: 'draft', title: values.title, ...logExtra },
    },
    now,
  );
  return { id, code };
}

export async function createVideo(
  db: Db,
  actor: Actor,
  input: VideoMetaPatch & { title: string },
  now: Date,
): Promise<{ id: string; code: string }> {
  return db.transaction(async (tx) => {
    if (!can(actor, 'script.create')) throw forbidden();
    const title = requireTitle(input.title);
    return insertDraft(tx, actor, { ...pickMeta(input), title }, emptyScript(), {}, now);
  });
}

/** The same script with fresh scene and line ids; the call to action follows its line. */
function withFreshIds(body: ScriptBody): ScriptBody {
  const lineIds = new Map<string, string>();
  const scenes = body.scenes.map((scene) => ({
    ...scene,
    id: newId(),
    lines: scene.lines.map((line) => {
      const id = newId();
      lineIds.set(line.id, id);
      return { ...line, id };
    }),
  }));
  const cta = body.cta && lineIds.has(body.cta.lineId) ? { ...body.cta, lineId: lineIds.get(body.cta.lineId)! } : null;
  return { ...structuredClone(body), scenes, cta };
}

/** Copy meta needed to carry on a series; approval, production state, due date and comments start fresh. */
const EPISODE_COPY_KEYS = [
  'seriesId',
  'cycleId',
  'plannedMonth',
  'categoryKey',
  'treatmentKey',
  'profileKey',
  'characterKey',
  'contentType',
  'intent',
  'goalMetric',
  'mainIdea',
  'formatKey',
  'isTrialReel',
  'locationKeys',
  'cast',
  'props',
] as const satisfies readonly (keyof VideoRow)[];

/**
 * „Duplikovat jako nový díl série“: a new draft with the same meta and script (new ids) and the next
 * episode number. A video outside any series gets „ (díl N)“ in the title so the copy is told apart.
 */
export async function duplicateAsEpisode(
  db: Db,
  actor: Actor,
  videoId: string,
  now: Date,
): Promise<{ id: string; code: string }> {
  return db.transaction(async (tx) => {
    if (!can(actor, 'script.create')) throw forbidden();
    const source = await loadVideo(tx, videoId);
    const body = source.draft ?? (await latestVersion(tx, videoId))?.body ?? emptyScript();
    const episodeNo = (source.episodeNo ?? 0) + 1;
    const title = source.seriesId ? source.title : `${source.title} (díl ${episodeNo})`;
    const meta = Object.fromEntries(EPISODE_COPY_KEYS.map((key) => [key, source[key]]));
    return insertDraft(tx, actor, { ...meta, title, episodeNo }, withFreshIds(body), { duplicatedFrom: source.code }, now);
  });
}

export async function updateVideoMeta(
  db: Db,
  actor: Actor,
  videoId: string,
  patch: VideoMetaPatch,
  now: Date,
): Promise<void> {
  await db.transaction(async (tx) => {
    const video = await loadVideo(tx, videoId, { lock: true });
    if (!can(actor, 'script.edit', { ownerId: video.ownerId })) throw forbidden();
    const changes = pickMeta(patch);
    if (changes.title !== undefined) changes.title = requireTitle(changes.title);
    const keys = Object.keys(changes) as (keyof VideoMetaPatch)[];
    if (keys.length === 0) return;
    await tx.update(s.videos).set({ ...changes, updatedAt: now }).where(eq(s.videos.id, videoId));
    await logActivity(
      tx,
      {
        actorId: actor.id,
        videoId,
        entity: 'video',
        entityId: videoId,
        action: 'video.meta_updated',
        before: Object.fromEntries(keys.map((k) => [k, video[k as keyof VideoRow]])),
        after: Object.fromEntries(keys.map((k) => [k, changes[k]])),
      },
      now,
    );
  });
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function isScriptBody(value: unknown): value is ScriptBody {
  if (!value || typeof value !== 'object') return false;
  const b = value as Record<string, unknown>;
  return (
    Array.isArray(b.hooks) &&
    Array.isArray(b.scenes) &&
    b.scenes.every((sc) => sc && typeof sc === 'object' && Array.isArray((sc as { lines?: unknown }).lines)) &&
    (b.cta === null || typeof b.cta === 'object') &&
    typeof b.caption === 'string' &&
    isStringArray(b.hashtags) &&
    typeof b.viewerLearns === 'string' &&
    typeof b.source === 'string' &&
    typeof b.differsFromLast3 === 'string'
  );
}

export const LOCKED_MESSAGE = 'Schválený scénář je zamčený. Nejdřív ho odemkni.';

/** Autosave: deliberately writes no activity and sends no notifications. */
export async function saveDraft(db: Db, actor: Actor, videoId: string, body: ScriptBody, now: Date): Promise<void> {
  await db.transaction(async (tx) => {
    const video = await loadVideo(tx, videoId, { lock: true });
    if (!can(actor, 'script.edit', { ownerId: video.ownerId })) throw forbidden();
    const status = statusOf(video);
    if (status === 'approved' && !video.editingAfterApproval) throw new DomainError('INVALID_TRANSITION', LOCKED_MESSAGE);
    if (status === 'postponed' || status === 'cancelled') {
      throw new DomainError('INVALID_TRANSITION', 'Odložený nebo zrušený scénář nejde upravovat.');
    }
    if (!isScriptBody(body)) throw new DomainError('VALIDATION', 'Neplatný scénář.');
    await tx.update(s.videos).set({ draft: body, updatedAt: now }).where(eq(s.videos.id, videoId));
  });
}

export async function submitForReview(
  db: Db,
  actor: Actor,
  videoId: string,
  input: { changeSummary?: string },
  now: Date,
): Promise<{ versionId: string; versionNo: number }> {
  return db.transaction(async (tx) => {
    const video = await loadVideo(tx, videoId, { lock: true });
    if (!can(actor, 'script.submit', { ownerId: video.ownerId })) throw forbidden();
    const status = statusOf(video);
    if (!canSubmit({ status, editingAfterApproval: video.editingAfterApproval })) {
      throw new DomainError('INVALID_TRANSITION', 'Scénář teď nejde odeslat ke schválení.');
    }
    if (!video.draft) throw new DomainError('VALIDATION', 'Scénář je prázdný.');

    const previous = await latestVersion(tx, videoId);
    const versionNo = (previous?.versionNo ?? 0) + 1;
    const versionId = newId();
    const nextStatus = statusAfterSubmit(previous !== undefined);

    await tx.insert(s.scriptVersions).values({
      id: versionId,
      videoId,
      versionNo,
      body: video.draft,
      meta: snapshotMeta(video),
      origin: 'submit',
      changeSummary: input.changeSummary?.trim() ?? '',
      createdBy: actor.id,
      createdAt: now,
    });
    await tx
      .update(s.videos)
      .set({
        approvalStatus: nextStatus,
        editingAfterApproval: false,
        approvedBy: [],
        approvedAt: null,
        updatedAt: now,
      })
      .where(eq(s.videos.id, videoId));
    await remapOpenAnchors(tx, videoId, video.draft, now);

    await logActivity(
      tx,
      {
        actorId: actor.id,
        videoId,
        entity: 'script_version',
        entityId: versionId,
        action: 'version.submitted',
        before: { status },
        after: { status: nextStatus, versionNo },
      },
      now,
    );
    return { versionId, versionNo };
  });
}

/** Re-locates anchors of every non-closed root comment in `body` (detaching those that vanished). */
export async function remapOpenAnchors(
  tx: Tx,
  videoId: string,
  body: ScriptBody,
  now: Date,
  exceptCommentId?: string,
): Promise<void> {
  const roots = await tx
    .select()
    .from(s.comments)
    .where(and(eq(s.comments.videoId, videoId), sql`${s.comments.parentId} is null`));
  for (const comment of roots) {
    if (!comment.anchor || comment.status === 'closed' || comment.id === exceptCommentId) continue;
    const anchor = remapAnchor(comment.anchor, body);
    if (JSON.stringify(anchor) === JSON.stringify(comment.anchor)) continue;
    await tx.update(s.comments).set({ anchor, updatedAt: now }).where(eq(s.comments.id, comment.id));
  }
}

export async function unlockForEdit(db: Db, actor: Actor, videoId: string, now: Date): Promise<void> {
  await db.transaction(async (tx) => {
    const video = await loadVideo(tx, videoId, { lock: true });
    if (!can(actor, 'script.unlock', { ownerId: video.ownerId })) throw forbidden();
    if (statusOf(video) !== 'approved' || video.editingAfterApproval) {
      throw new DomainError('INVALID_TRANSITION', 'Odemknout jde jen schválený a zamčený scénář.');
    }
    await tx.update(s.videos).set({ editingAfterApproval: true, updatedAt: now }).where(eq(s.videos.id, videoId));
    await logActivity(
      tx,
      {
        actorId: actor.id,
        videoId,
        entity: 'video',
        entityId: videoId,
        action: 'video.unlocked',
        before: { editingAfterApproval: false },
        after: { editingAfterApproval: true },
      },
      now,
    );
  });
}

export async function setLifecycle(
  db: Db,
  actor: Actor,
  videoId: string,
  input: { action: 'postpone' | 'cancel' | 'restore'; reason: string },
  now: Date,
): Promise<void> {
  await db.transaction(async (tx) => {
    const video = await loadVideo(tx, videoId, { lock: true });
    if (!can(actor, 'script.lifecycle', { ownerId: video.ownerId })) throw forbidden();
    const status = statusOf(video);
    const reason = input.reason.trim();

    let next: 'postponed' | 'cancelled' | 'draft';
    let action: string;
    if (input.action === 'restore') {
      if (status !== 'postponed' && status !== 'cancelled') {
        throw new DomainError('INVALID_TRANSITION', 'Obnovit jde jen odložený nebo zrušený scénář.');
      }
      next = 'draft';
      action = 'video.restored';
    } else {
      next = input.action === 'postpone' ? 'postponed' : 'cancelled';
      action = input.action === 'postpone' ? 'video.postponed' : 'video.cancelled';
      if (!reason) throw new DomainError('VALIDATION', 'Napiš důvod.');
      if (status === next) throw new DomainError('INVALID_TRANSITION', 'Scénář už v tomto stavu je.');
    }

    await tx
      .update(s.videos)
      .set({
        approvalStatus: next,
        lifecycleReason: next === 'draft' ? '' : reason,
        ...(next === 'draft' ? { approvedBy: [], approvedAt: null, editingAfterApproval: false } : {}),
        updatedAt: now,
      })
      .where(eq(s.videos.id, videoId));
    await logActivity(
      tx,
      {
        actorId: actor.id,
        videoId,
        entity: 'video',
        entityId: videoId,
        action,
        before: { status },
        after: next === 'draft' ? { status: next } : { status: next, reason },
      },
      now,
    );
  });
}

/**
 * Ticks or unticks a manual check (e.g. „Logický dialog“) for the latest version. Writes no activity:
 * it is a working checklist, not a decision. Allowed for approvers and for whoever may edit the script.
 */
export async function setManualCheck(
  db: Db,
  actor: Actor,
  input: { videoId: string; versionId: string; code: string; checked: boolean },
  now: Date,
): Promise<void> {
  await db.transaction(async (tx) => {
    const video = await loadVideo(tx, input.videoId, { lock: true });
    if (!can(actor, 'approval.decide') && !can(actor, 'script.edit', { ownerId: video.ownerId })) throw forbidden();

    const [version] = await tx
      .select({ id: s.scriptVersions.id })
      .from(s.scriptVersions)
      .where(and(eq(s.scriptVersions.id, input.versionId), eq(s.scriptVersions.videoId, video.id)));
    if (!version) throw new DomainError('NOT_FOUND', 'Verze nenalezena.');
    if ((await latestVersion(tx, video.id))?.id !== version.id) throw new DomainError('STALE', 'Mezitím vznikla nová verze.');

    const rule = (await loadRules(tx)).find((r) => r.code === input.code && r.mode === 'manual' && r.enabled);
    if (!rule) throw new DomainError('VALIDATION', 'Tuto kontrolu nejde odškrtnout ručně.');

    const forVersion = { ...video.manualChecks?.[version.id], [rule.code]: input.checked };
    await tx
      .update(s.videos)
      .set({ manualChecks: { ...video.manualChecks, [version.id]: forVersion }, updatedAt: now })
      .where(eq(s.videos.id, video.id));
  });
}
