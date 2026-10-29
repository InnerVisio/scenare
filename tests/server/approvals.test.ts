import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as s from '@/db/schema';
import { decide } from '@/server/approvals';
import { createComment, decideSuggestion } from '@/server/comments';
import { flagNumber } from '@/server/numbers';
import { createVideo, saveDraft, setLifecycle, submitForReview } from '@/server/videos';
import {
  activityFor,
  anchorIn,
  createSubmitted,
  expectDomainError,
  getComment,
  getVideo,
  minutesLater,
  notifiedUsers,
  NOW,
  setupWorld,
  type World,
} from './helpers';

let w: World;
beforeAll(async () => {
  w = await setupWorld();
}, 60_000);

const decisionsOf = async (versionId: string) =>
  w.db.select().from(s.approvalDecisions).where(eq(s.approvalDecisions.versionId, versionId));

describe('full review cycle', () => {
  it('create → submit v1 → Radek returns → admin accepts suggestion → submit v2 → Honza approves → Radek approves', async () => {
    // create + submit v1
    const { id: videoId } = await createVideo(w.db, w.admin, { title: 'Celý cyklus' }, minutesLater(0));
    await saveDraft(w.db, w.admin, videoId, w.cleanBody(), minutesLater(0));
    const v1 = await submitForReview(w.db, w.admin, videoId, { changeSummary: 'První odeslání' }, minutesLater(1));
    expect((await getVideo(w.db, videoId)).approvalStatus).toBe('in_review');

    // Honza suggests a change on v1, Radek returns with a note
    const { id: commentId } = await createComment(
      w.db,
      w.honza,
      {
        videoId,
        versionId: v1.versionId,
        type: 'change_request',
        body: 'Ať to zní míň přehnaně.',
        anchor: anchorIn(w.cleanBody(), 'v036-s1-l2', 'nejdražší'),
        suggestion: { replacement: 'největší' },
      },
      minutesLater(2),
    );
    const returned = await decide(
      w.db,
      w.radek,
      { videoId, versionId: v1.versionId, decision: 'return', note: 'Zkrátit a zmírnit.' },
      minutesLater(3),
    );
    expect(returned).toEqual({ state: 'returned', waitingFor: [] });
    expect((await getVideo(w.db, videoId)).approvalStatus).toBe('returned');
    const [retLog] = await activityFor(w.db, videoId, 'approval.returned');
    expect(retLog).toMatchObject({ actorId: w.radek.id, entity: 'approval_decision' });
    expect(retLog.after).toMatchObject({ decision: 'return', note: 'Zkrátit a zmírnit.' });
    expect(await notifiedUsers(w.db, retLog.id)).toEqual([w.admin.id]);

    // admin accepts the suggestion, resubmits as v2 → final_review
    await decideSuggestion(w.db, w.admin, { commentId, accept: true }, minutesLater(4));
    expect((await getComment(w.db, commentId)).status).toBe('addressed');
    const v2 = await submitForReview(w.db, w.admin, videoId, { changeSummary: 'Zapracováno' }, minutesLater(5));
    expect(v2.versionNo).toBe(2);
    expect((await getVideo(w.db, videoId)).approvalStatus).toBe('final_review');

    // Honza approves → pending, waiting for Radek
    const first = await decide(w.db, w.honza, { videoId, versionId: v2.versionId, decision: 'approve' }, minutesLater(6));
    expect(first).toEqual({ state: 'pending', waitingFor: ['Radek'] });
    const mid = await getVideo(w.db, videoId);
    expect(mid).toMatchObject({ approvalStatus: 'final_review', approvedBy: [], approvedAt: null });
    const [honzaLog] = await activityFor(w.db, videoId, 'approval.approved');
    expect(honzaLog).toMatchObject({ actorId: w.honza.id });
    expect(honzaLog.after).toMatchObject({ decision: 'approve', overrodeWarnings: false });
    expect(await notifiedUsers(w.db, honzaLog.id)).toEqual([w.admin.id]);

    // Radek approves → approved
    const second = await decide(w.db, w.radek, { videoId, versionId: v2.versionId, decision: 'approve' }, minutesLater(7));
    expect(second).toEqual({ state: 'approved', waitingFor: [] });
    const done = await getVideo(w.db, videoId);
    expect(done.approvalStatus).toBe('approved');
    expect(done.approvedBy).toEqual(['Honza', 'Radek']);
    expect(done.approvedAt?.getTime()).toBe(minutesLater(7).getTime());
    const [finalLog] = await activityFor(w.db, videoId, 'video.approved');
    expect(finalLog).toMatchObject({ actorId: w.radek.id, entity: 'video' });
    expect(finalLog.after).toMatchObject({ status: 'approved', approvedBy: ['Honza', 'Radek'] });
    expect(await decisionsOf(v2.versionId)).toHaveLength(2);
    expect(await decisionsOf(v1.versionId)).toHaveLength(1);
  });
});

describe('versions bind decisions (Review Focus 2)', () => {
  it('deciding on an old version is STALE', async () => {
    const { videoId, versionId: v1 } = await createSubmitted(w);
    await decide(w.db, w.radek, { videoId, versionId: v1, decision: 'return', note: 'Předělat.' }, NOW);
    const v2 = await submitForReview(w.db, w.admin, videoId, {}, NOW);

    for (const actor of [w.honza, w.radek]) {
      await expectDomainError(
        decide(w.db, actor, { videoId, versionId: v1, decision: 'approve' }, NOW),
        'STALE',
        'Mezitím vznikla nová verze.',
      );
    }
    expect(await decisionsOf(v2.versionId)).toHaveLength(0);
    expect((await getVideo(w.db, videoId)).approvalStatus).toBe('final_review');
  });

  it('an approval of the previous version does not count for the next one', async () => {
    const { videoId, versionId: v1 } = await createSubmitted(w);
    await decide(w.db, w.honza, { videoId, versionId: v1, decision: 'approve' }, NOW);
    await decide(w.db, w.radek, { videoId, versionId: v1, decision: 'return', note: 'Ne.' }, NOW);
    expect((await getVideo(w.db, videoId)).approvalStatus).toBe('returned');
    // late decision by Honza on the already returned version
    await expectDomainError(
      decide(w.db, w.honza, { videoId, versionId: v1, decision: 'approve' }, NOW),
      'INVALID_TRANSITION',
    );

    const v2 = await submitForReview(w.db, w.admin, videoId, {}, NOW);
    const res = await decide(w.db, w.radek, { videoId, versionId: v2.versionId, decision: 'approve' }, NOW);
    expect(res).toEqual({ state: 'pending', waitingFor: ['Honza'] });
    expect((await getVideo(w.db, videoId)).approvalStatus).toBe('final_review');
  });

  it('a version that is not part of the video is NOT_FOUND', async () => {
    const a = await createSubmitted(w);
    const b = await createSubmitted(w);
    await expectDomainError(
      decide(w.db, w.honza, { videoId: a.videoId, versionId: b.versionId, decision: 'approve' }, NOW),
      'NOT_FOUND',
    );
    await expectDomainError(
      decide(w.db, w.honza, { videoId: 'nope', versionId: b.versionId, decision: 'approve' }, NOW),
      'NOT_FOUND',
      'Scénář nenalezen.',
    );
  });
});

describe('return', () => {
  it('requires a note or a comment by the actor on that version', async () => {
    const { videoId, versionId } = await createSubmitted(w);
    await expectDomainError(
      decide(w.db, w.honza, { videoId, versionId, decision: 'return', note: '   ' }, NOW),
      'VALIDATION',
      'Napiš, co je potřeba upravit.',
    );
    await expectDomainError(decide(w.db, w.honza, { videoId, versionId, decision: 'return' }, NOW), 'VALIDATION');
    // someone else's comment does not count
    await createComment(w.db, w.radek, { videoId, versionId, type: 'remark', body: 'Radkova poznámka' }, NOW);
    await expectDomainError(decide(w.db, w.honza, { videoId, versionId, decision: 'return' }, NOW), 'VALIDATION');
    expect(await decisionsOf(versionId)).toHaveLength(0);

    await createComment(w.db, w.honza, { videoId, versionId, type: 'change_request', body: 'Změnit začátek' }, NOW);
    const res = await decide(w.db, w.honza, { videoId, versionId, decision: 'return' }, NOW);
    expect(res.state).toBe('returned');
    expect((await decisionsOf(versionId))[0]).toMatchObject({ decision: 'return', note: '' });
  });

  it('a single return wins even after the other leader approved', async () => {
    const { videoId, versionId } = await createSubmitted(w);
    await decide(w.db, w.radek, { videoId, versionId, decision: 'approve' }, NOW);
    const res = await decide(w.db, w.honza, { videoId, versionId, decision: 'return', note: 'Ne.' }, NOW);
    expect(res).toEqual({ state: 'returned', waitingFor: [] });
  });
});

describe('permissions and state', () => {
  it('admin cannot decide; script must be awaiting decision', async () => {
    const { videoId, versionId } = await createSubmitted(w);
    await expectDomainError(decide(w.db, w.admin, { videoId, versionId, decision: 'approve' }, NOW), 'FORBIDDEN');
    expect(await decisionsOf(versionId)).toHaveLength(0);

    await setLifecycle(w.db, w.admin, videoId, { action: 'postpone', reason: 'Později' }, NOW);
    await expectDomainError(decide(w.db, w.honza, { videoId, versionId, decision: 'approve' }, NOW), 'INVALID_TRANSITION');
  });

  it('the same leader cannot approve the same version twice', async () => {
    const { videoId, versionId } = await createSubmitted(w);
    await decide(w.db, w.honza, { videoId, versionId, decision: 'approve' }, NOW);
    await expectDomainError(
      decide(w.db, w.honza, { videoId, versionId, decision: 'approve' }, NOW),
      'VALIDATION',
      'Tento scénář už jsi schválil.',
    );
  });
});

describe('warnings and override', () => {
  it('approving with an open comment needs override; the override is logged', async () => {
    const { videoId, versionId } = await createSubmitted(w);
    await createComment(w.db, w.radek, { videoId, versionId, type: 'remark', body: 'Ještě otevřené' }, NOW);

    const err = await expectDomainError(
      decide(w.db, w.honza, { videoId, versionId, decision: 'approve' }, NOW),
      'VALIDATION',
      'Scénář má nevyřešené body. Schválit i tak?',
    );
    expect(err.details).toEqual(['1 nevyřešený komentář']);
    expect(await decisionsOf(versionId)).toHaveLength(0);
    expect(await activityFor(w.db, videoId, 'approval.approved')).toHaveLength(0);

    const res = await decide(w.db, w.honza, { videoId, versionId, decision: 'approve', overrideWarnings: true }, NOW);
    expect(res.state).toBe('pending');
    expect((await decisionsOf(versionId))[0]).toMatchObject({ overrodeWarnings: true });
    const [log] = await activityFor(w.db, videoId, 'approval.approved');
    expect(log.after).toMatchObject({ decision: 'approve', overrodeWarnings: true });
  });

  it('overrideWarnings without any blocker is not recorded as an override', async () => {
    const { videoId, versionId } = await createSubmitted(w);
    await decide(w.db, w.honza, { videoId, versionId, decision: 'approve', overrideWarnings: true }, NOW);
    expect((await decisionsOf(versionId))[0]).toMatchObject({ overrodeWarnings: false });
  });

  it('closed and addressed comments and replies do not block; pending numbers and failing reject rules do', async () => {
    const { videoId, versionId } = await createSubmitted(w);
    const { id: c1 } = await createComment(w.db, w.radek, { videoId, versionId, type: 'remark', body: 'a' }, NOW);
    await w.db.update(s.comments).set({ status: 'addressed' }).where(eq(s.comments.id, c1));
    await w.db.insert(s.comments).values({ id: 'reply-open', videoId, versionId, parentId: c1, authorId: w.admin.id, type: 'remark', body: 'r', status: 'open' });
    await createComment(w.db, w.radek, { videoId, versionId, type: 'approval', body: 'Souhlasím' }, NOW);
    await flagNumber(w.db, w.honza, { videoId, fieldId: 'hook:A:text', quotedText: 'autu' }, NOW);

    const err = await expectDomainError(
      decide(w.db, w.honza, { videoId, versionId, decision: 'approve' }, NOW),
      'VALIDATION',
      'Scénář má nevyřešené body. Schválit i tak?',
    );
    expect(err.details).toEqual(['1 nepotvrzené číslo']);
  });

  it('lists failing auto "reject" rules by label; manual pending rules do not block', async () => {
    const { id: videoId } = await createVideo(w.db, w.admin, { title: 'Prázdný hook' }, NOW);
    const body = w.cleanBody();
    await saveDraft(w.db, w.admin, videoId, { ...body, hooks: body.hooks.map((h) => (h.id === 'A' ? { ...h, text: '' } : h)), source: '' }, NOW);
    const { versionId } = await submitForReview(w.db, w.admin, videoId, {}, NOW);
    const err = await expectDomainError(decide(w.db, w.honza, { videoId, versionId, decision: 'approve' }, NOW), 'VALIDATION');
    expect(err.details.some((d) => d.startsWith('Hook do 2 s, bez představování'))).toBe(true);
    expect(err.details.some((d) => d.startsWith('Přidaná hodnota + zdroj'))).toBe(true);
    expect(err.details.some((d) => d.includes('Logický dialog'))).toBe(false);
  });
});

describe('approval policy', () => {
  it('any_leadership: one approval is enough, approvedBy lists who approved', async () => {
    const world = await setupWorld();
    await world.db.update(s.settings).set({ approvalPolicy: 'any_leadership' }).where(eq(s.settings.id, 'global'));
    const { videoId, versionId } = await createSubmitted(world);
    const res = await decide(world.db, world.radek, { videoId, versionId, decision: 'approve' }, NOW);
    expect(res).toEqual({ state: 'approved', waitingFor: [] });
    expect(await getVideo(world.db, videoId)).toMatchObject({ approvalStatus: 'approved', approvedBy: ['Radek'] });
  }, 60_000);

  it('series_guarantor: only the series guarantor decides', async () => {
    await w.db.insert(s.series).values({ id: 'ser-g', code: 'S-G', name: 'Série', guarantorId: w.radek.id });
    const { videoId, versionId } = await createSubmitted(w);
    await w.db.update(s.videos).set({ seriesId: 'ser-g' }).where(eq(s.videos.id, videoId));
    await w.db.update(s.settings).set({ approvalPolicy: 'series_guarantor' }).where(eq(s.settings.id, 'global'));
    try {
      // a series episode is checked against the 20–30 s range, so the 18 s fixture needs the override
      const first = await decide(w.db, w.honza, { videoId, versionId, decision: 'approve', overrideWarnings: true }, NOW);
      expect(first).toEqual({ state: 'pending', waitingFor: ['Radek'] });
      const second = await decide(w.db, w.radek, { videoId, versionId, decision: 'approve', overrideWarnings: true }, NOW);
      expect(second.state).toBe('approved');
      expect((await getVideo(w.db, videoId)).approvedBy).toEqual(['Honza', 'Radek']);
    } finally {
      await w.db.update(s.settings).set({ approvalPolicy: 'all_leadership' }).where(eq(s.settings.id, 'global'));
    }
  });
});

describe('concurrent decisions', () => {
  it('two leaders deciding at once end up approved exactly once', async () => {
    const { videoId, versionId } = await createSubmitted(w);
    const results = await Promise.all([
      decide(w.db, w.honza, { videoId, versionId, decision: 'approve' }, NOW),
      decide(w.db, w.radek, { videoId, versionId, decision: 'approve' }, NOW),
    ]);
    expect(results.map((r) => r.state).sort()).toEqual(['approved', 'pending']);
    expect((await getVideo(w.db, videoId)).approvedBy).toEqual(['Honza', 'Radek']);
    expect(await activityFor(w.db, videoId, 'video.approved')).toHaveLength(1);
  });
});
