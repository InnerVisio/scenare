import { and, eq } from 'drizzle-orm';
import type { Db } from '@/db/client';
import * as s from '@/db/schema';
import { newId } from '@/domain/ids';
import { can } from '@/domain/policy/can';
import { getFieldText } from '@/domain/script/fields';
import { logActivity } from './activity';
import type { Actor } from './actor';
import { DomainError } from './errors';
import { loadVideo, referenceBody } from './loaders';

const forbidden = () => new DomainError('FORBIDDEN', 'K této akci nemáš oprávnění.');

export async function flagNumber(
  db: Db,
  actor: Actor,
  input: { videoId: string; fieldId: string; quotedText: string },
  now: Date,
): Promise<{ id: string }> {
  return db.transaction(async (tx) => {
    const video = await loadVideo(tx, input.videoId, { lock: true });
    if (!can(actor, 'number.flag')) throw forbidden();
    if (!input.quotedText.trim()) throw new DomainError('VALIDATION', 'Označ číslo v textu.');
    const body = await referenceBody(tx, video);
    const text = body ? getFieldText(body, input.fieldId) : undefined;
    if (text === undefined || !text.includes(input.quotedText)) {
      throw new DomainError('VALIDATION', 'Označený text nesedí.');
    }
    const [existing] = await tx
      .select({ id: s.numberChecks.id })
      .from(s.numberChecks)
      .where(
        and(
          eq(s.numberChecks.videoId, video.id),
          eq(s.numberChecks.fieldId, input.fieldId),
          eq(s.numberChecks.quotedText, input.quotedText),
        ),
      );
    if (existing) throw new DomainError('VALIDATION', 'Toto číslo už je označené.');

    const id = newId();
    await tx.insert(s.numberChecks).values({
      id,
      videoId: video.id,
      fieldId: input.fieldId,
      quotedText: input.quotedText,
      status: 'pending',
      flaggedBy: actor.id,
      createdAt: now,
    });
    await logActivity(
      tx,
      {
        actorId: actor.id,
        videoId: video.id,
        entity: 'number_check',
        entityId: id,
        action: 'number.flagged',
        after: { fieldId: input.fieldId, quotedText: input.quotedText, status: 'pending' },
      },
      now,
    );
    return { id };
  });
}

export async function confirmNumber(
  db: Db,
  actor: Actor,
  input: { numberCheckId: string },
  now: Date,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [check] = await tx.select().from(s.numberChecks).where(eq(s.numberChecks.id, input.numberCheckId));
    if (!check) throw new DomainError('NOT_FOUND', 'Číslo nenalezeno.');
    await loadVideo(tx, check.videoId, { lock: true });
    if (!can(actor, 'number.confirm')) throw forbidden();
    const [fresh] = await tx.select().from(s.numberChecks).where(eq(s.numberChecks.id, check.id));
    if (fresh.status === 'confirmed') throw new DomainError('VALIDATION', 'Číslo už je potvrzené.');

    await tx
      .update(s.numberChecks)
      .set({ status: 'confirmed', confirmedBy: actor.id, confirmedAt: now })
      .where(eq(s.numberChecks.id, check.id));
    await logActivity(
      tx,
      {
        actorId: actor.id,
        videoId: check.videoId,
        entity: 'number_check',
        entityId: check.id,
        action: 'number.confirmed',
        before: { status: 'pending' },
        after: { status: 'confirmed', quotedText: check.quotedText },
      },
      now,
    );
  });
}
