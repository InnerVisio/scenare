import { and, eq, inArray } from 'drizzle-orm';
import type { Db } from '@/db/client';
import * as s from '@/db/schema';
import { applySuggestion } from '@/domain/anchors/suggestion';
import type { Anchor } from '@/domain/anchors/remap';
import { newId } from '@/domain/ids';
import { can } from '@/domain/policy/can';
import { getFieldText } from '@/domain/script/fields';
import type { ScriptBody } from '@/domain/script/types';
import {
  COMMENT_TYPES,
  nextCommentStatus,
  initialCommentStatus,
  type CommentEvent,
  type CommentStatus,
  type CommentType,
} from '@/domain/workflow/comments';
import { WorkflowTransitionError } from '@/domain/workflow/errors';
import { logActivity } from './activity';
import type { Actor } from './actor';
import { DomainError } from './errors';
import {
  latestVersion,
  loadComment,
  loadVideo,
  statusOf,
  type Executor,
  type Tx,
} from './loaders';
import { LOCKED_MESSAGE, remapOpenAnchors, snapshotMeta } from './videos';

const forbidden = () => new DomainError('FORBIDDEN', 'K této akci nemáš oprávnění.');
const STALE_SUGGESTION = 'Text se mezitím změnil, návrh nelze použít automaticky.';

export type NewAnchor = Omit<Anchor, 'state'>;

function validateAnchor(body: ScriptBody | null, anchor: NewAnchor): void {
  const text = body ? getFieldText(body, anchor.fieldId) : undefined;
  const ok =
    text !== undefined &&
    anchor.quotedText.length > 0 &&
    Number.isInteger(anchor.from) &&
    Number.isInteger(anchor.to) &&
    anchor.from >= 0 &&
    anchor.to > anchor.from &&
    anchor.to <= text.length &&
    text.slice(anchor.from, anchor.to) === anchor.quotedText;
  if (!ok) throw new DomainError('VALIDATION', 'Označený text nesedí.');
}

async function requireUsers(tx: Executor, ids: string[], message: string): Promise<void> {
  if (ids.length === 0) return;
  const found = await tx.select({ id: s.users.id }).from(s.users).where(inArray(s.users.id, ids));
  if (found.length !== ids.length) throw new DomainError('VALIDATION', message);
}

export interface CreateCommentInput {
  videoId: string;
  versionId: string | null;
  type: CommentType;
  body: string;
  anchor?: NewAnchor;
  suggestion?: { replacement: string };
  assigneeId?: string | null;
  mentions?: string[];
}

export async function createComment(db: Db, actor: Actor, input: CreateCommentInput, now: Date): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const video = await loadVideo(tx, input.videoId, { lock: true });
    if (!can(actor, 'comment.create')) throw forbidden();
    if (input.suggestion && !can(actor, 'comment.suggest')) throw forbidden();

    if (!COMMENT_TYPES.includes(input.type)) throw new DomainError('VALIDATION', 'Neznámý typ komentáře.');
    const body = input.body.trim();
    if (!body) throw new DomainError('VALIDATION', 'Napiš komentář.');
    if (input.suggestion && !input.anchor) {
      throw new DomainError('VALIDATION', 'Návrh změny musí mít označený text.');
    }

    const latest = await latestVersion(tx, video.id);
    if (latest) {
      if (input.versionId === null) throw new DomainError('VALIDATION', 'Chybí verze scénáře.');
      const [known] = await tx
        .select({ id: s.scriptVersions.id })
        .from(s.scriptVersions)
        .where(and(eq(s.scriptVersions.id, input.versionId), eq(s.scriptVersions.videoId, video.id)));
      if (!known) throw new DomainError('VALIDATION', 'Verze nenalezena.');
      if (known.id !== latest.id) throw new DomainError('STALE', 'Mezitím vznikla nová verze.');
    } else if (input.versionId !== null) {
      throw new DomainError('VALIDATION', 'Verze nenalezena.');
    }

    const mentions = [...new Set(input.mentions ?? [])];
    await requireUsers(tx, mentions, 'Zmíněný uživatel neexistuje.');
    if (input.assigneeId) await requireUsers(tx, [input.assigneeId], 'Přiřazený uživatel neexistuje.');

    let anchor: Anchor | null = null;
    if (input.anchor) {
      validateAnchor(latest?.body ?? video.draft ?? null, input.anchor);
      anchor = {
        fieldId: input.anchor.fieldId,
        from: input.anchor.from,
        to: input.anchor.to,
        quotedText: input.anchor.quotedText,
        state: 'attached',
      };
    }

    const id = newId();
    await tx.insert(s.comments).values({
      id,
      videoId: video.id,
      versionId: input.versionId,
      parentId: null,
      authorId: actor.id,
      type: input.type,
      body,
      mentions,
      assigneeId: input.assigneeId ?? null,
      status: initialCommentStatus(input.type),
      anchor,
      suggestion: input.suggestion
        ? { replacement: input.suggestion.replacement, state: 'pending', decidedBy: null, decidedAt: null }
        : null,
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(
      tx,
      {
        actorId: actor.id,
        videoId: video.id,
        entity: 'comment',
        entityId: id,
        action: 'comment.created',
        after: { type: input.type, hasSuggestion: !!input.suggestion, versionId: input.versionId },
      },
      now,
    );
    return { id };
  });
}

export async function replyToComment(
  db: Db,
  actor: Actor,
  input: { parentId: string; body: string; mentions?: string[] },
  now: Date,
): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const found = await loadComment(tx, input.parentId);
    // Threads are one level deep: a reply to a reply attaches to the thread root.
    const root = found.parentId ? await loadComment(tx, found.parentId) : found;
    await loadVideo(tx, root.videoId, { lock: true });
    if (!can(actor, 'comment.create')) throw forbidden();
    const body = input.body.trim();
    if (!body) throw new DomainError('VALIDATION', 'Napiš odpověď.');
    const mentions = [...new Set(input.mentions ?? [])];
    await requireUsers(tx, mentions, 'Zmíněný uživatel neexistuje.');

    const id = newId();
    await tx.insert(s.comments).values({
      id,
      videoId: root.videoId,
      versionId: root.versionId,
      parentId: root.id,
      authorId: actor.id,
      type: 'remark',
      body,
      mentions,
      status: 'open',
      createdAt: now,
      updatedAt: now,
    });
    await logActivity(
      tx,
      { actorId: actor.id, videoId: root.videoId, entity: 'comment', entityId: id, action: 'comment.replied', after: { parentId: root.id } },
      now,
    );
    return { id };
  });
}

function transition(current: string, event: CommentEvent): CommentStatus {
  try {
    return nextCommentStatus(current as CommentStatus, event);
  } catch (error) {
    if (error instanceof WorkflowTransitionError) {
      throw new DomainError('INVALID_TRANSITION', 'Tuto změnu stavu komentáře nejde provést.');
    }
    throw error;
  }
}

async function changeStatus(
  db: Db,
  actor: Actor,
  commentId: string,
  event: CommentEvent,
  now: Date,
): Promise<void> {
  const rule = {
    address: { permission: 'comment.address', action: 'comment.addressed' },
    close: { permission: 'comment.close', action: 'comment.closed' },
    reopen: { permission: 'comment.reopen', action: 'comment.reopened' },
  } as const;
  const { permission, action } = rule[event];

  await db.transaction(async (tx) => {
    const peek = await loadComment(tx, commentId);
    const video = await loadVideo(tx, peek.videoId, { lock: true });
    if (!can(actor, permission, { ownerId: video.ownerId })) throw forbidden();
    const comment = await loadComment(tx, commentId);
    if (comment.parentId) throw new DomainError('VALIDATION', 'Stav jde měnit jen u hlavního komentáře.');
    const next = transition(comment.status, event);
    await tx.update(s.comments).set({ status: next, updatedAt: now }).where(eq(s.comments.id, comment.id));
    await logActivity(
      tx,
      {
        actorId: actor.id,
        videoId: comment.videoId,
        entity: 'comment',
        entityId: comment.id,
        action,
        before: { status: comment.status },
        after: { status: next },
      },
      now,
    );
  });
}

export const markAddressed = (db: Db, actor: Actor, input: { commentId: string }, now: Date) =>
  changeStatus(db, actor, input.commentId, 'address', now);
export const closeComment = (db: Db, actor: Actor, input: { commentId: string }, now: Date) =>
  changeStatus(db, actor, input.commentId, 'close', now);
export const reopenComment = (db: Db, actor: Actor, input: { commentId: string }, now: Date) =>
  changeStatus(db, actor, input.commentId, 'reopen', now);

export async function decideSuggestion(
  db: Db,
  actor: Actor,
  input: { commentId: string; accept: boolean; reason?: string },
  now: Date,
): Promise<void> {
  await db.transaction(async (tx) => {
    const peek = await loadComment(tx, input.commentId);
    const video = await loadVideo(tx, peek.videoId, { lock: true });
    if (!can(actor, 'suggestion.decide', { ownerId: video.ownerId })) throw forbidden();
    // Re-read under the video lock so two concurrent decisions cannot both see "pending".
    const comment = await loadComment(tx, input.commentId);
    const suggestion = comment.suggestion;
    if (comment.parentId || !suggestion || !comment.anchor) {
      throw new DomainError('VALIDATION', 'Tento komentář nemá návrh změny.');
    }
    if (suggestion.state !== 'pending') throw new DomainError('VALIDATION', 'Návrh už byl vyřízen.');

    const nextStatus: CommentStatus = comment.status === 'open' ? transition(comment.status, 'address') : (comment.status as CommentStatus);
    const decidedAt = now.toISOString();

    if (!input.accept) {
      const reason = input.reason?.trim() ?? '';
      if (!reason) throw new DomainError('VALIDATION', 'Napiš důvod odmítnutí.');
      await tx.insert(s.comments).values({
        id: newId(),
        videoId: comment.videoId,
        versionId: comment.versionId,
        parentId: comment.id,
        authorId: actor.id,
        type: 'remark',
        body: reason,
        status: 'open',
        createdAt: now,
        updatedAt: now,
      });
      await tx
        .update(s.comments)
        .set({ suggestion: { ...suggestion, state: 'rejected', decidedBy: actor.id, decidedAt, reason }, status: nextStatus, updatedAt: now })
        .where(eq(s.comments.id, comment.id));
      await logActivity(
        tx,
        {
          actorId: actor.id,
          videoId: comment.videoId,
          entity: 'comment',
          entityId: comment.id,
          action: 'suggestion.rejected',
          after: { reason },
        },
        now,
      );
      return;
    }

    const status = statusOf(video);
    if (status === 'postponed' || status === 'cancelled') {
      throw new DomainError('INVALID_TRANSITION', 'Odložený nebo zrušený scénář nejde upravovat.');
    }
    const locked = status === 'approved' && !video.editingAfterApproval;
    const [author] = await tx.select({ role: s.users.role }).from(s.users).where(eq(s.users.id, comment.authorId));
    const authorIsLeadership = author?.role === 'leadership';
    // Only leadership suggestions may change an approved script; they are recorded as a new, already approved version.
    if (locked && !authorIsLeadership) throw new DomainError('INVALID_TRANSITION', LOCKED_MESSAGE);
    if (!video.draft) throw new DomainError('STALE', STALE_SUGGESTION);

    const applied = applySuggestion(video.draft, comment.anchor, suggestion.replacement);
    if (!applied.ok) throw new DomainError('STALE', STALE_SUGGESTION);

    await tx.update(s.videos).set({ draft: applied.body, updatedAt: now }).where(eq(s.videos.id, video.id));
    await tx
      .update(s.comments)
      .set({
        anchor: applied.anchor,
        suggestion: { ...suggestion, state: 'accepted', decidedBy: actor.id, decidedAt },
        status: nextStatus,
        updatedAt: now,
      })
      .where(eq(s.comments.id, comment.id));

    let created: { versionId: string; versionNo: number } | null = null;
    if (locked) created = await createAcceptedVersion(tx, actor, video, applied.body, comment.id, now);

    await logActivity(
      tx,
      {
        actorId: actor.id,
        videoId: video.id,
        entity: 'comment',
        entityId: comment.id,
        action: 'suggestion.accepted',
        after: { replacement: suggestion.replacement, ...(created ?? {}) },
      },
      now,
    );
  });
}

/** Records accepted leadership suggestions on an approved script as a new version that keeps the approval. */
async function createAcceptedVersion(
  tx: Tx,
  actor: Actor,
  video: Awaited<ReturnType<typeof loadVideo>>,
  body: ScriptBody,
  exceptCommentId: string,
  now: Date,
): Promise<{ versionId: string; versionNo: number }> {
  const previous = await latestVersion(tx, video.id);
  if (!previous) throw new DomainError('INVALID_TRANSITION', 'Schválený scénář nemá žádnou verzi.');
  const versionId = newId();
  const versionNo = previous.versionNo + 1;
  await tx.insert(s.scriptVersions).values({
    id: versionId,
    videoId: video.id,
    versionNo,
    body,
    meta: previous.meta ?? snapshotMeta(video),
    origin: 'accepted_suggestions',
    changeSummary: 'Přijatý návrh změny',
    createdBy: actor.id,
    createdAt: now,
  });

  const decisions = await tx.select().from(s.approvalDecisions).where(eq(s.approvalDecisions.versionId, previous.id));
  if (decisions.length > 0) {
    await tx.insert(s.approvalDecisions).values(decisions.map((d) => ({ ...d, id: newId(), versionId })));
  }
  const manual = video.manualChecks?.[previous.id];
  if (manual) {
    await tx
      .update(s.videos)
      .set({ manualChecks: { ...video.manualChecks, [versionId]: manual } })
      .where(eq(s.videos.id, video.id));
  }
  await remapOpenAnchors(tx, video.id, body, now, exceptCommentId);
  return { versionId, versionNo };
}

