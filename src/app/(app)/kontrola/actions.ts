'use server';

import { z } from 'zod';
import { COMMENT_TYPES } from '@/domain/workflow/comments';
import { decide, type DecideResult } from '@/server/approvals';
import type { ActionResult } from '@/server/actionResult';
import {
  closeComment,
  createComment,
  decideSuggestion,
  markAddressed,
  reopenComment,
  replyToComment,
} from '@/server/comments';
import { confirmNumber, flagNumber } from '@/server/numbers';
import { markSeen } from '@/server/queries';
import { setManualCheck } from '@/server/videos';
import { runAction } from '../_actions/run';

// Thin wrappers around the use cases: authenticate, validate, run with the current time, refresh the
// cached pages and return a plain result (never throw for expected business failures).

const id = z.string().min(1).max(64);
const text = (max = 5000) => z.string().max(max);
const mentions = z.array(id).max(20).optional();

const anchor = z.object({
  fieldId: z.string().min(1).max(200),
  from: z.number().int(),
  to: z.number().int(),
  quotedText: text(),
});

const decideSchema = z.object({
  videoId: id,
  versionId: id,
  decision: z.enum(['approve', 'return']),
  note: text().optional(),
  overrideWarnings: z.boolean().optional(),
});

const createCommentSchema = z.object({
  videoId: id,
  versionId: id.nullable(),
  type: z.enum(COMMENT_TYPES),
  body: text(),
  anchor: anchor.optional(),
  suggestion: z.object({ replacement: text() }).optional(),
  mentions,
});

const replySchema = z.object({ parentId: id, body: text(), mentions });
const decideSuggestionSchema = z.object({ commentId: id, accept: z.boolean(), reason: text().optional() });
const commentIdSchema = z.object({ commentId: id });
const flagNumberSchema = z.object({ videoId: id, fieldId: z.string().min(1).max(200), quotedText: text(200) });
const confirmNumberSchema = z.object({ numberCheckId: id });
const manualCheckSchema = z.object({ videoId: id, versionId: id, code: z.string().min(1).max(64), checked: z.boolean() });
const markSeenSchema = z.object({ videoId: id, versionId: id });

export async function decideAction(input: z.input<typeof decideSchema>): Promise<ActionResult<DecideResult>> {
  return runAction(input, decideSchema, (db, actor, i, now) => decide(db, actor, i, now));
}

export async function createCommentAction(input: z.input<typeof createCommentSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(input, createCommentSchema, (db, actor, i, now) => createComment(db, actor, i, now));
}

export async function replyToCommentAction(input: z.input<typeof replySchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(input, replySchema, (db, actor, i, now) => replyToComment(db, actor, i, now));
}

export async function decideSuggestionAction(input: z.input<typeof decideSuggestionSchema>): Promise<ActionResult> {
  return runAction(input, decideSuggestionSchema, (db, actor, i, now) => decideSuggestion(db, actor, i, now));
}

export async function markAddressedAction(input: z.input<typeof commentIdSchema>): Promise<ActionResult> {
  return runAction(input, commentIdSchema, (db, actor, i, now) => markAddressed(db, actor, i, now));
}

export async function closeCommentAction(input: z.input<typeof commentIdSchema>): Promise<ActionResult> {
  return runAction(input, commentIdSchema, (db, actor, i, now) => closeComment(db, actor, i, now));
}

export async function reopenCommentAction(input: z.input<typeof commentIdSchema>): Promise<ActionResult> {
  return runAction(input, commentIdSchema, (db, actor, i, now) => reopenComment(db, actor, i, now));
}

export async function flagNumberAction(input: z.input<typeof flagNumberSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(input, flagNumberSchema, (db, actor, i, now) => flagNumber(db, actor, i, now));
}

export async function confirmNumberAction(input: z.input<typeof confirmNumberSchema>): Promise<ActionResult> {
  return runAction(input, confirmNumberSchema, (db, actor, i, now) => confirmNumber(db, actor, i, now));
}

export async function setManualCheckAction(input: z.input<typeof manualCheckSchema>): Promise<ActionResult> {
  return runAction(input, manualCheckSchema, (db, actor, i, now) => setManualCheck(db, actor, i, now));
}

/** Remembering what the actor has seen changes nothing visible, so it does not refresh the pages. */
export async function markSeenAction(input: z.input<typeof markSeenSchema>): Promise<ActionResult> {
  return runAction(input, markSeenSchema, (db, actor, i, now) => markSeen(db, actor, i, now), { revalidate: false });
}
