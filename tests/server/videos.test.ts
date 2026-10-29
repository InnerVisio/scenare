import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as s from '@/db/schema';
import { getVideoDetail } from '@/server/queries';
import { emptyScript } from '@/domain/script/template';
import type { ScriptBody } from '@/domain/script/types';
import {
  createVideo,
  saveDraft,
  setLifecycle,
  setManualCheck,
  submitForReview,
  unlockForEdit,
  updateVideoMeta,
} from '@/server/videos';
import {
  activityFor,
  createSubmitted,
  expectDomainError,
  getVideo,
  minutesLater,
  NOW,
  setupWorld,
  type World,
} from './helpers';

let w: World;
beforeAll(async () => {
  w = await setupWorld();
}, 60_000);

async function newVideo(title = 'Nový scénář') {
  return createVideo(w.db, w.admin, { title }, NOW);
}

describe('createVideo', () => {
  it('creates the next free code with an empty draft and logs activity', async () => {
    const { id, code } = await createVideo(
      w.db,
      w.admin,
      { title: '  Fixace hypotéky  ', plannedMonth: '2026-12', categoryKey: 'produkt' },
      NOW,
    );
    expect(code).toBe('V037');
    const row = await getVideo(w.db, id);
    expect(row).toMatchObject({
      code: 'V037',
      title: 'Fixace hypotéky',
      approvalStatus: 'draft',
      productionStatus: 'waiting',
      ownerId: w.admin.id,
      plannedMonth: '2026-12',
      categoryKey: 'produkt',
      editingAfterApproval: false,
    });
    expect(row.draft).toEqual({ ...emptyScript(), hooks: expect.anything(), scenes: expect.anything() });
    expect(row.draft?.scenes).toHaveLength(3);
    expect(row.createdAt.getTime()).toBe(NOW.getTime());

    const [log] = await activityFor(w.db, id, 'video.created');
    expect(log).toMatchObject({ actorId: w.admin.id, entity: 'video', entityId: id });
    expect(log.after).toMatchObject({ code: 'V037', status: 'draft' });
  });

  it('numbers keep counting', async () => {
    const a = await newVideo();
    const b = await newVideo();
    expect(Number(b.code.slice(1))).toBe(Number(a.code.slice(1)) + 1);
  });

  it('concurrent creates get distinct codes', async () => {
    const results = await Promise.all([newVideo('A'), newVideo('B'), newVideo('C')]);
    expect(new Set(results.map((r) => r.code)).size).toBe(3);
  });

  it('rejects an empty title and non-creators', async () => {
    await expectDomainError(createVideo(w.db, w.admin, { title: '   ' }, NOW), 'VALIDATION');
    await expectDomainError(createVideo(w.db, w.honza, { title: 'x' }, NOW), 'FORBIDDEN');
  });
});

describe('updateVideoMeta', () => {
  it('patches whitelisted fields, never touches approval, logs before/after', async () => {
    const { id } = await newVideo('Původní');
    await updateVideoMeta(
      w.db,
      w.admin,
      id,
      {
        title: 'Nový název',
        goalMetric: 'saves',
        isTrialReel: true,
        cast: ['Honza'],
        // @ts-expect-error approval fields are not part of the patch type and must be ignored
        approvalStatus: 'approved',
      },
      minutesLater(5),
    );
    const row = await getVideo(w.db, id);
    expect(row).toMatchObject({
      title: 'Nový název',
      goalMetric: 'saves',
      isTrialReel: true,
      cast: ['Honza'],
      approvalStatus: 'draft',
    });
    expect(row.updatedAt.getTime()).toBe(minutesLater(5).getTime());
    const [log] = await activityFor(w.db, id, 'video.meta_updated');
    expect(log.before).toMatchObject({ title: 'Původní' });
    expect(log.after).toMatchObject({ title: 'Nový název', goalMetric: 'saves' });
  });

  it('validates title, permissions and existence', async () => {
    const { id } = await newVideo();
    await expectDomainError(updateVideoMeta(w.db, w.admin, id, { title: ' ' }, NOW), 'VALIDATION');
    await expectDomainError(updateVideoMeta(w.db, w.honza, id, { title: 'x' }, NOW), 'FORBIDDEN');
    await expectDomainError(updateVideoMeta(w.db, w.admin, 'nope', { title: 'x' }, NOW), 'NOT_FOUND', 'Scénář nenalezen.');
  });
});

function withHookText(body: ScriptBody, text: string): ScriptBody {
  return { ...body, hooks: body.hooks.map((h) => (h.id === 'A' ? { ...h, text } : h)) };
}

describe('saveDraft', () => {
  it('stores the draft without activity or notifications', async () => {
    const { id } = await newVideo();
    const before = (await activityFor(w.db, id)).length;
    const body = withHookText(emptyScript(), 'Ruka s propiskou');
    await saveDraft(w.db, w.admin, id, body, minutesLater(1));
    const row = await getVideo(w.db, id);
    expect(row.draft).toEqual(body);
    expect(row.updatedAt.getTime()).toBe(minutesLater(1).getTime());
    expect((await activityFor(w.db, id)).length).toBe(before);
  });

  it('is refused on an approved, locked script (Czech message)', async () => {
    const { id } = await newVideo();
    await w.db.update(s.videos).set({ approvalStatus: 'approved' }).where(eq(s.videos.id, id));
    await expectDomainError(
      saveDraft(w.db, w.admin, id, emptyScript(), NOW),
      'INVALID_TRANSITION',
      'Schválený scénář je zamčený. Nejdřív ho odemkni.',
    );
  });

  it('is refused on postponed/cancelled scripts, for leadership, and for malformed bodies', async () => {
    const { id } = await newVideo();
    await setLifecycle(w.db, w.admin, id, { action: 'postpone', reason: 'Čeká na natáčení' }, NOW);
    await expectDomainError(
      saveDraft(w.db, w.admin, id, emptyScript(), NOW),
      'INVALID_TRANSITION',
      'Odložený nebo zrušený scénář nejde upravovat.',
    );
    const other = await newVideo();
    await expectDomainError(saveDraft(w.db, w.honza, other.id, emptyScript(), NOW), 'FORBIDDEN');
    await expectDomainError(saveDraft(w.db, w.admin, other.id, { nope: true } as unknown as ScriptBody, NOW), 'VALIDATION');
    await expectDomainError(saveDraft(w.db, w.admin, 'nope', emptyScript(), NOW), 'NOT_FOUND');
  });

  it('is allowed while the submitted version awaits decision', async () => {
    const { videoId } = await createSubmitted(w);
    const body = withHookText(w.cleanBody(), 'Jiný hook');
    await saveDraft(w.db, w.admin, videoId, body, NOW);
    expect((await getVideo(w.db, videoId)).draft).toEqual(body);
  });
});

describe('submitForReview', () => {
  it('creates version 1 with meta snapshot, sets in_review, logs and notifies leadership', async () => {
    const { id } = await createVideo(w.db, w.admin, { title: 'Odeslat', categoryKey: 'produkt', plannedMonth: '2026-12' }, NOW);
    await saveDraft(w.db, w.admin, id, w.cleanBody(), NOW);
    const { versionId, versionNo } = await submitForReview(w.db, w.admin, id, { changeSummary: 'První odeslání' }, minutesLater(2));
    expect(versionNo).toBe(1);

    const [version] = await w.db.select().from(s.scriptVersions).where(eq(s.scriptVersions.id, versionId));
    expect(version).toMatchObject({ videoId: id, versionNo: 1, origin: 'submit', changeSummary: 'První odeslání', createdBy: w.admin.id });
    expect(version.body).toEqual(w.cleanBody());
    expect(version.meta).toMatchObject({ title: 'Odeslat', categoryKey: 'produkt', plannedMonth: '2026-12' });

    const row = await getVideo(w.db, id);
    expect(row).toMatchObject({ approvalStatus: 'in_review', editingAfterApproval: false, approvedBy: [], approvedAt: null });

    const [log] = await activityFor(w.db, id, 'version.submitted');
    expect(log).toMatchObject({ entity: 'script_version', entityId: versionId, actorId: w.admin.id });
    expect(log.before).toMatchObject({ status: 'draft' });
    expect(log.after).toMatchObject({ status: 'in_review', versionNo: 1 });

    const notified = await w.db.select().from(s.notifications).where(eq(s.notifications.activityId, log.id));
    expect(notified.map((n) => n.userId).sort()).toEqual([w.honza.id, w.radek.id].sort());
    expect(notified.some((n) => n.userId === w.admin.id)).toBe(false);
  });

  it('a resubmission after return is final_review with version 2', async () => {
    const { videoId } = await createSubmitted(w);
    await w.db.update(s.videos).set({ approvalStatus: 'returned' }).where(eq(s.videos.id, videoId));
    const res = await submitForReview(w.db, w.admin, videoId, {}, NOW);
    expect(res.versionNo).toBe(2);
    expect((await getVideo(w.db, videoId)).approvalStatus).toBe('final_review');
  });

  it('is refused while awaiting decision, for leadership, and without draft', async () => {
    const { videoId } = await createSubmitted(w);
    await expectDomainError(submitForReview(w.db, w.admin, videoId, {}, NOW), 'INVALID_TRANSITION');
    const other = await newVideo();
    await expectDomainError(submitForReview(w.db, w.honza, other.id, {}, NOW), 'FORBIDDEN');
    await w.db.update(s.videos).set({ draft: null }).where(eq(s.videos.id, other.id));
    await expectDomainError(submitForReview(w.db, w.admin, other.id, {}, NOW), 'VALIDATION');
  });

  it('remaps anchors of open and addressed comments to the new body; closed ones stay put', async () => {
    const { videoId, versionId } = await createSubmitted(w);
    const body = w.cleanBody();
    const lineId = 'v036-s1-l2';
    const text = body.scenes[0].lines[1].text; // "To je ta nejdražší sázka v dějinách."
    const quote = 'nejdražší';
    const from = text.indexOf(quote);
    const anchor = { fieldId: `line:${lineId}:text`, from, to: from + quote.length, quotedText: quote, state: 'attached' as const };
    const mk = (id: string, status: string, a = anchor) =>
      w.db.insert(s.comments).values({ id, videoId, versionId, authorId: w.honza.id, type: 'remark', body: 'x', status, anchor: a });
    await mk('rm-open', 'open');
    await mk('rm-addr', 'addressed');
    await mk('rm-closed', 'closed');
    await mk('rm-gone', 'open', { ...anchor, from: 0, to: 4, quotedText: 'zmizí-úplně' });

    // Prepend text so offsets shift; remove the quote of rm-gone (never existed).
    const edited: ScriptBody = {
      ...body,
      scenes: body.scenes.map((sc, i) =>
        i === 0
          ? { ...sc, lines: sc.lines.map((l) => (l.id === lineId ? { ...l, text: `Hele, ${l.text}` } : l)) }
          : sc,
      ),
    };
    await saveDraft(w.db, w.admin, videoId, edited, NOW);
    await w.db.update(s.videos).set({ approvalStatus: 'returned' }).where(eq(s.videos.id, videoId));
    await submitForReview(w.db, w.admin, videoId, {}, NOW);

    const get = async (id: string) => (await w.db.select().from(s.comments).where(eq(s.comments.id, id)))[0];
    expect((await get('rm-open')).anchor).toMatchObject({ from: from + 6, to: from + 6 + quote.length, state: 'attached' });
    expect((await get('rm-addr')).anchor).toMatchObject({ from: from + 6, state: 'attached' });
    expect((await get('rm-closed')).anchor).toMatchObject({ from, state: 'attached' });
    expect((await get('rm-gone')).anchor).toMatchObject({ state: 'detached' });
  });
});

describe('unlockForEdit', () => {
  it('approved → unlock → save → submit → final_review, approval reset', async () => {
    const { videoId } = await createSubmitted(w);
    await w.db
      .update(s.videos)
      .set({ approvalStatus: 'approved', approvedBy: ['Honza', 'Radek'], approvedAt: NOW })
      .where(eq(s.videos.id, videoId));

    await unlockForEdit(w.db, w.admin, videoId, minutesLater(1));
    const unlocked = await getVideo(w.db, videoId);
    expect(unlocked).toMatchObject({ approvalStatus: 'approved', editingAfterApproval: true });
    const [log] = await activityFor(w.db, videoId, 'video.unlocked');
    expect(log).toMatchObject({ actorId: w.admin.id, entity: 'video' });

    const body = withHookText(w.cleanBody(), 'Upravený hook po schválení');
    await saveDraft(w.db, w.admin, videoId, body, minutesLater(2));
    const res = await submitForReview(w.db, w.admin, videoId, {}, minutesLater(3));
    expect(res.versionNo).toBe(2);
    const after = await getVideo(w.db, videoId);
    expect(after).toMatchObject({
      approvalStatus: 'final_review',
      editingAfterApproval: false,
      approvedBy: [],
      approvedAt: null,
    });
  });

  it('only for approved scripts that are not already unlocked; checks permission', async () => {
    const { videoId } = await createSubmitted(w);
    await expectDomainError(unlockForEdit(w.db, w.admin, videoId, NOW), 'INVALID_TRANSITION');
    await w.db.update(s.videos).set({ approvalStatus: 'approved' }).where(eq(s.videos.id, videoId));
    await expectDomainError(unlockForEdit(w.db, w.honza, videoId, NOW), 'FORBIDDEN');
    await unlockForEdit(w.db, w.admin, videoId, NOW);
    await expectDomainError(unlockForEdit(w.db, w.admin, videoId, NOW), 'INVALID_TRANSITION');
  });
});

describe('setLifecycle', () => {
  it('postpone → restore, cancel → restore, with reasons and activity', async () => {
    const { id } = await newVideo();
    await setLifecycle(w.db, w.admin, id, { action: 'postpone', reason: 'Čeká na natáčení' }, NOW);
    expect(await getVideo(w.db, id)).toMatchObject({ approvalStatus: 'postponed', lifecycleReason: 'Čeká na natáčení' });
    const [p] = await activityFor(w.db, id, 'video.postponed');
    expect(p.before).toMatchObject({ status: 'draft' });
    expect(p.after).toMatchObject({ status: 'postponed', reason: 'Čeká na natáčení' });

    await setLifecycle(w.db, w.admin, id, { action: 'restore', reason: '' }, NOW);
    expect((await getVideo(w.db, id)).approvalStatus).toBe('draft');
    expect(await activityFor(w.db, id, 'video.restored')).toHaveLength(1);

    await setLifecycle(w.db, w.admin, id, { action: 'cancel', reason: 'Téma padlo' }, NOW);
    expect(await getVideo(w.db, id)).toMatchObject({ approvalStatus: 'cancelled', lifecycleReason: 'Téma padlo' });
    expect(await activityFor(w.db, id, 'video.cancelled')).toHaveLength(1);
    await setLifecycle(w.db, w.honza, id, { action: 'restore', reason: '' }, NOW);
    expect((await getVideo(w.db, id)).approvalStatus).toBe('draft');
  });

  it('restore clears the previous approval and the unlock flag', async () => {
    const { videoId } = await createSubmitted(w);
    await w.db
      .update(s.videos)
      .set({ approvalStatus: 'approved', approvedBy: ['Honza', 'Radek'], approvedAt: NOW, editingAfterApproval: true })
      .where(eq(s.videos.id, videoId));
    await setLifecycle(w.db, w.admin, videoId, { action: 'postpone', reason: 'Později' }, NOW);
    await setLifecycle(w.db, w.admin, videoId, { action: 'restore', reason: '' }, NOW);
    expect(await getVideo(w.db, videoId)).toMatchObject({
      approvalStatus: 'draft',
      approvedBy: [],
      approvedAt: null,
      editingAfterApproval: false,
    });
  });

  it('requires a reason, valid source status and permission', async () => {
    const { id } = await newVideo();
    await expectDomainError(setLifecycle(w.db, w.admin, id, { action: 'postpone', reason: '  ' }, NOW), 'VALIDATION', 'Napiš důvod.');
    await expectDomainError(setLifecycle(w.db, w.admin, id, { action: 'restore', reason: '' }, NOW), 'INVALID_TRANSITION');
    await setLifecycle(w.db, w.admin, id, { action: 'postpone', reason: 'x' }, NOW);
    await expectDomainError(setLifecycle(w.db, w.admin, id, { action: 'postpone', reason: 'y' }, NOW), 'INVALID_TRANSITION');
    // postponed → cancelled directly is fine
    await setLifecycle(w.db, w.admin, id, { action: 'cancel', reason: 'z' }, NOW);
  });
});

describe('setManualCheck', () => {
  it('lets leadership tick and untick a manual check on the latest version, without activity', async () => {
    const { videoId, versionId } = await createSubmitted(w);
    const before = (await activityFor(w.db, videoId)).length;

    await setManualCheck(w.db, w.radek, { videoId, versionId, code: 'LOGICAL_DIALOG', checked: true }, minutesLater(1));
    expect((await getVideo(w.db, videoId)).manualChecks).toEqual({ [versionId]: { LOGICAL_DIALOG: true } });

    await setManualCheck(w.db, w.honza, { videoId, versionId, code: 'GDPR', checked: true }, minutesLater(2));
    await setManualCheck(w.db, w.radek, { videoId, versionId, code: 'LOGICAL_DIALOG', checked: false }, minutesLater(3));
    expect((await getVideo(w.db, videoId)).manualChecks[versionId]).toEqual({ LOGICAL_DIALOG: false, GDPR: true });
    expect((await activityFor(w.db, videoId)).length).toBe(before);
  });

  it('lets the owner (admin) tick a manual check', async () => {
    const { videoId, versionId } = await createSubmitted(w);
    await setManualCheck(w.db, w.admin, { videoId, versionId, code: 'PILLAR', checked: true }, NOW);
    expect((await getVideo(w.db, videoId)).manualChecks[versionId]).toEqual({ PILLAR: true });
  });

  it('refuses users who neither decide nor own the script', async () => {
    const { videoId, versionId } = await createSubmitted(w);
    const production = { id: 'u-production', role: 'production' as const, name: 'Produkce' };
    const stranger = { id: 'u-marketer', role: 'marketer' as const, name: 'Marketér' };
    for (const actor of [production, stranger]) {
      await expectDomainError(
        setManualCheck(w.db, actor, { videoId, versionId, code: 'GDPR', checked: true }, NOW),
        'FORBIDDEN',
      );
    }
    expect((await getVideo(w.db, videoId)).manualChecks).toEqual({});
  });

  it('only accepts the latest version', async () => {
    const { videoId, versionId } = await createSubmitted(w);
    await w.db.update(s.videos).set({ approvalStatus: 'returned' }).where(eq(s.videos.id, videoId));
    await submitForReview(w.db, w.admin, videoId, {}, minutesLater(5));
    await expectDomainError(
      setManualCheck(w.db, w.radek, { videoId, versionId, code: 'GDPR', checked: true }, minutesLater(6)),
      'STALE',
    );
    await expectDomainError(
      setManualCheck(w.db, w.radek, { videoId, versionId: 'nope', code: 'GDPR', checked: true }, minutesLater(6)),
      'NOT_FOUND',
    );
  });

  it('rejects codes that are not manual rules', async () => {
    const { videoId, versionId } = await createSubmitted(w);
    await expectDomainError(setManualCheck(w.db, w.radek, { videoId, versionId, code: 'HOOK', checked: true }, NOW), 'VALIDATION');
    await expectDomainError(setManualCheck(w.db, w.radek, { videoId, versionId, code: 'XYZ', checked: true }, NOW), 'VALIDATION');
  });

  it('feeds the check results', async () => {
    const { videoId, versionId } = await createSubmitted(w);
    await setManualCheck(w.db, w.radek, { videoId, versionId, code: 'GDPR', checked: true }, NOW);
    const detail = await getVideoDetail(w.db, w.radek, videoId);
    expect(detail.checks.find((c) => c.code === 'GDPR')?.status).toBe('manual_done');
  });
});
