import { eq } from 'drizzle-orm';
import { expect } from 'vitest';
import { createTestDb, type Db } from '@/db/client';
import * as s from '@/db/schema';
import { runSeed } from '@/db/seed';
import type { ScriptBody } from '@/domain/script/types';
import { loadActor, type Actor } from '@/server/actor';
import { DomainError, type DomainErrorCode } from '@/server/errors';
import { createVideo, saveDraft, submitForReview } from '@/server/videos';

export const NOW = new Date('2026-10-29T10:00:00+01:00');

export function minutesLater(minutes: number): Date {
  return new Date(NOW.getTime() + minutes * 60_000);
}

export interface World {
  db: Db;
  admin: Actor;
  honza: Actor;
  radek: Actor;
  /** A script body that passes every automatic "reject" rule (copy of the seeded V036 draft). */
  cleanBody: () => ScriptBody;
}

export async function setupWorld(): Promise<World> {
  const db = await createTestDb();
  await runSeed(db, { demo: true });
  const byEmail = async (email: string) => {
    const [u] = await db.select().from(s.users).where(eq(s.users.email, email));
    return loadActor(db, u.id);
  };
  const [v036] = await db.select().from(s.videos).where(eq(s.videos.code, 'V036'));
  const clean = v036.draft as ScriptBody;
  return {
    db,
    admin: await byEmail('admin@gta.local'),
    honza: await byEmail('honza@gta.local'),
    radek: await byEmail('radek@gta.local'),
    cleanBody: () => structuredClone(clean),
  };
}

export async function expectDomainError(
  promise: Promise<unknown>,
  code: DomainErrorCode,
  message?: string,
): Promise<DomainError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(DomainError);
  const domainError = error as DomainError;
  expect(domainError.code).toBe(code);
  if (message !== undefined) expect(domainError.message).toBe(message);
  return domainError;
}

/** New video with the clean body, submitted once by admin → status in_review, version 1. */
export async function createSubmitted(
  w: World,
  title = 'Testovací scénář',
): Promise<{ videoId: string; versionId: string; code: string }> {
  const { id: videoId, code } = await createVideo(w.db, w.admin, { title }, NOW);
  await saveDraft(w.db, w.admin, videoId, w.cleanBody(), NOW);
  const { versionId } = await submitForReview(w.db, w.admin, videoId, {}, NOW);
  return { videoId, versionId, code };
}

export async function getVideo(db: Db, id: string) {
  const [row] = await db.select().from(s.videos).where(eq(s.videos.id, id));
  return row;
}

export async function activityFor(db: Db, videoId: string, action?: string) {
  const rows = await db.select().from(s.activityLog).where(eq(s.activityLog.videoId, videoId));
  const filtered = action ? rows.filter((r) => r.action === action) : rows;
  return filtered.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

/** Anchor (without `state`) for `quote` inside a line of `body`. */
export function anchorIn(body: ScriptBody, lineId: string, quote: string) {
  const text = body.scenes.flatMap((sc) => sc.lines).find((l) => l.id === lineId)?.text;
  const from = text?.indexOf(quote) ?? -1;
  if (text === undefined || from < 0) throw new Error(`"${quote}" not found in ${lineId}`);
  return { fieldId: `line:${lineId}:text`, from, to: from + quote.length, quotedText: quote };
}

export function withLineText(body: ScriptBody, lineId: string, text: string): ScriptBody {
  return {
    ...body,
    scenes: body.scenes.map((sc) => ({
      ...sc,
      lines: sc.lines.map((l) => (l.id === lineId ? { ...l, text } : l)),
    })),
  };
}

export async function getComment(db: Db, id: string) {
  const [row] = await db.select().from(s.comments).where(eq(s.comments.id, id));
  return row;
}

export async function notifiedUsers(db: Db, activityId: string): Promise<string[]> {
  const rows = await db.select().from(s.notifications).where(eq(s.notifications.activityId, activityId));
  return rows.map((r) => r.userId).sort();
}
