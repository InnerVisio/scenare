import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as s from '@/db/schema';
import { confirmNumber, flagNumber } from '@/server/numbers';
import { createVideo, saveDraft } from '@/server/videos';
import { activityFor, createSubmitted, expectDomainError, minutesLater, NOW, setupWorld, type World } from './helpers';

let w: World;
beforeAll(async () => {
  w = await setupWorld();
}, 60_000);

const row = async (id: string) => (await w.db.select().from(s.numberChecks).where(eq(s.numberChecks.id, id)))[0];

describe('flagNumber / confirmNumber', () => {
  it('flag creates a pending check, confirm sets confirmed by leadership', async () => {
    const { videoId } = await createSubmitted(w);
    const { id } = await flagNumber(w.db, w.admin, { videoId, fieldId: 'caption', quotedText: 'Kdo dřív' }, minutesLater(1));
    expect(await row(id)).toMatchObject({
      videoId,
      fieldId: 'caption',
      quotedText: 'Kdo dřív',
      status: 'pending',
      flaggedBy: w.admin.id,
      confirmedBy: null,
      confirmedAt: null,
    });
    const [flagged] = await activityFor(w.db, videoId, 'number.flagged');
    expect(flagged).toMatchObject({ actorId: w.admin.id, entity: 'number_check', entityId: id });

    await confirmNumber(w.db, w.honza, { numberCheckId: id }, minutesLater(2));
    const confirmed = await row(id);
    expect(confirmed).toMatchObject({ status: 'confirmed', confirmedBy: w.honza.id });
    expect(confirmed.confirmedAt?.getTime()).toBe(minutesLater(2).getTime());
    const [log] = await activityFor(w.db, videoId, 'number.confirmed');
    expect(log).toMatchObject({ actorId: w.honza.id, entityId: id });
  });

  it('admin cannot confirm; confirming twice and unknown ids fail', async () => {
    const { videoId } = await createSubmitted(w);
    const { id } = await flagNumber(w.db, w.honza, { videoId, fieldId: 'caption', quotedText: 'Kdo' }, NOW);
    await expectDomainError(confirmNumber(w.db, w.admin, { numberCheckId: id }, NOW), 'FORBIDDEN');
    await confirmNumber(w.db, w.radek, { numberCheckId: id }, NOW);
    await expectDomainError(confirmNumber(w.db, w.radek, { numberCheckId: id }, NOW), 'VALIDATION');
    await expectDomainError(confirmNumber(w.db, w.radek, { numberCheckId: 'nope' }, NOW), 'NOT_FOUND', 'Číslo nenalezeno.');
  });

  it('flag validates that the quote is in the field of the latest version (or draft)', async () => {
    const { videoId } = await createSubmitted(w);
    await expectDomainError(
      flagNumber(w.db, w.honza, { videoId, fieldId: 'caption', quotedText: 'tohle tam není' }, NOW),
      'VALIDATION',
    );
    await expectDomainError(flagNumber(w.db, w.honza, { videoId, fieldId: 'nope', quotedText: 'x' }, NOW), 'VALIDATION');
    await expectDomainError(flagNumber(w.db, w.honza, { videoId, fieldId: 'caption', quotedText: ' ' }, NOW), 'VALIDATION');
    await expectDomainError(flagNumber(w.db, w.honza, { videoId: 'nope', fieldId: 'caption', quotedText: 'x' }, NOW), 'NOT_FOUND');
    await expectDomainError(
      flagNumber(w.db, { id: 'p', role: 'production', name: 'P' }, { videoId, fieldId: 'caption', quotedText: 'Kdo' }, NOW),
      'FORBIDDEN',
    );

    // without a version the draft is used
    const { id: fresh } = await createVideo(w.db, w.admin, { title: 'Bez verze' }, NOW);
    await saveDraft(w.db, w.admin, fresh, w.cleanBody(), NOW);
    await flagNumber(w.db, w.admin, { videoId: fresh, fieldId: 'caption', quotedText: 'Kdo' }, NOW);
  });

  it('flagging the same quote twice is refused', async () => {
    const { videoId } = await createSubmitted(w);
    await flagNumber(w.db, w.honza, { videoId, fieldId: 'caption', quotedText: 'Kdo' }, NOW);
    await expectDomainError(flagNumber(w.db, w.radek, { videoId, fieldId: 'caption', quotedText: 'Kdo' }, NOW), 'VALIDATION');
  });
});
