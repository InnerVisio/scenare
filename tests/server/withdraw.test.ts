import { beforeAll, describe, expect, it } from 'vitest';
import { createComment } from '@/server/comments';
import { saveDraft, submitForReview, withdrawFromReview } from '@/server/videos';
import { activityFor, createSubmitted, expectDomainError, getVideo, notifiedUsers, minutesLater, NOW, setupWorld, type World } from './helpers';

let w: World;
beforeAll(async () => {
  w = await setupWorld();
}, 60_000);

describe('withdrawFromReview', () => {
  it('returns the script to draft, notifies leadership and keeps history', async () => {
    const { videoId } = await createSubmitted(w);
    await withdrawFromReview(w.db, w.admin, videoId, minutesLater(1));
    expect(await getVideo(w.db, videoId)).toMatchObject({ approvalStatus: 'draft' });
    const [activity] = await activityFor(w.db, videoId, 'version.withdrawn');
    expect(activity).toBeDefined();
    expect((await notifiedUsers(w.db, activity.id)).sort()).toEqual([w.honza.id, w.radek.id].sort());
    // leadership queue is status-based: a draft no longer awaits a decision
    expect((await getVideo(w.db, videoId)).approvalStatus).not.toMatch(/review/);
    // the first version stays, so the next submit is version 2
    const again = await submitForReview(w.db, w.admin, videoId, {}, minutesLater(2));
    expect(again.versionNo).toBe(2);
  });

  it('rejects scripts that are not awaiting a decision and non-owners', async () => {
    const { videoId } = await createSubmitted(w);
    await expectDomainError(withdrawFromReview(w.db, w.honza, videoId, NOW), 'FORBIDDEN');
    await withdrawFromReview(w.db, w.admin, videoId, NOW);
    await expectDomainError(withdrawFromReview(w.db, w.admin, videoId, NOW), 'INVALID_TRANSITION');
  });
});

describe('submitForReview from review', () => {
  it('rejects an unchanged draft', async () => {
    const { videoId } = await createSubmitted(w);
    await expectDomainError(submitForReview(w.db, w.admin, videoId, {}, NOW), 'VALIDATION', 'Žádné změny k odeslání.');
  });

  it('creates version 2 and stays in_review when nothing happened on v1', async () => {
    const { videoId } = await createSubmitted(w);
    await saveDraft(w.db, w.admin, videoId, { ...w.cleanBody(), caption: 'Nový popisek' }, NOW);
    const res = await submitForReview(w.db, w.admin, videoId, {}, minutesLater(1));
    expect(res.versionNo).toBe(2);
    expect(await getVideo(w.db, videoId)).toMatchObject({ approvalStatus: 'in_review' });
    const [activity] = (await activityFor(w.db, videoId, 'version.submitted')).slice(-1);
    expect((await notifiedUsers(w.db, activity.id)).sort()).toEqual([w.honza.id, w.radek.id].sort());
  });

  it('goes to final_review when earlier versions have comments', async () => {
    const { videoId, versionId } = await createSubmitted(w);
    await createComment(w.db, w.honza, { videoId, versionId, type: 'remark', body: 'Poznámka' }, NOW);
    await saveDraft(w.db, w.admin, videoId, { ...w.cleanBody(), caption: 'Jiný popisek' }, NOW);
    const res = await submitForReview(w.db, w.admin, videoId, {}, minutesLater(1));
    expect(res.versionNo).toBe(2);
    expect(await getVideo(w.db, videoId)).toMatchObject({ approvalStatus: 'final_review' });
  });
});
