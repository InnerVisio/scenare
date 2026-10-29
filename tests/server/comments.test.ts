import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as s from '@/db/schema';
import { decide } from '@/server/approvals';
import {
  closeComment,
  createComment,
  decideSuggestion,
  markAddressed,
  reopenComment,
  replyToComment,
} from '@/server/comments';
import { createVideo, saveDraft, unlockForEdit } from '@/server/videos';
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
  withLineText,
  type World,
} from './helpers';

let w: World;
beforeAll(async () => {
  w = await setupWorld();
}, 60_000);

const LINE = 'v036-s1-l2'; // "To je ta nejdražší sázka v dějinách."

describe('createComment', () => {
  it('stores an anchored remark on the latest version, logs and notifies owner + mentions', async () => {
    const { videoId, versionId } = await createSubmitted(w);
    const anchor = anchorIn(w.cleanBody(), LINE, 'nejdražší');
    const { id } = await createComment(
      w.db,
      w.honza,
      { videoId, versionId, type: 'expert', body: 'Ověřit.', anchor, assigneeId: w.admin.id, mentions: [w.radek.id] },
      minutesLater(1),
    );
    expect(await getComment(w.db, id)).toMatchObject({
      videoId,
      versionId,
      parentId: null,
      authorId: w.honza.id,
      type: 'expert',
      body: 'Ověřit.',
      status: 'open',
      assigneeId: w.admin.id,
      mentions: [w.radek.id],
      anchor: { ...anchor, state: 'attached' },
      suggestion: null,
    });
    const [log] = await activityFor(w.db, videoId, 'comment.created');
    expect(log).toMatchObject({ actorId: w.honza.id, entity: 'comment', entityId: id });
    expect(await notifiedUsers(w.db, log.id)).toEqual([w.admin.id, w.radek.id].sort());
  });

  it('approval-type comments start closed', async () => {
    const { videoId, versionId } = await createSubmitted(w);
    const { id } = await createComment(w.db, w.radek, { videoId, versionId, type: 'approval', body: 'OK' }, NOW);
    expect((await getComment(w.db, id)).status).toBe('closed');
  });

  it('stores a pending suggestion', async () => {
    const { videoId, versionId } = await createSubmitted(w);
    const { id } = await createComment(
      w.db,
      w.honza,
      {
        videoId,
        versionId,
        type: 'change_request',
        body: 'Jinak',
        anchor: anchorIn(w.cleanBody(), LINE, 'nejdražší'),
        suggestion: { replacement: 'největší' },
      },
      NOW,
    );
    expect((await getComment(w.db, id)).suggestion).toEqual({
      replacement: 'největší',
      state: 'pending',
      decidedBy: null,
      decidedAt: null,
    });
  });

  it('validates anchor text, suggestion anchor, body, type and mentions', async () => {
    const { videoId, versionId } = await createSubmitted(w);
    const good = anchorIn(w.cleanBody(), LINE, 'nejdražší');
    const base = { videoId, versionId, type: 'remark' as const, body: 'x' };
    await expectDomainError(
      createComment(w.db, w.honza, { ...base, anchor: { ...good, quotedText: 'jiný text' } }, NOW),
      'VALIDATION',
      'Označený text nesedí.',
    );
    await expectDomainError(
      createComment(w.db, w.honza, { ...base, anchor: { ...good, fieldId: 'line:neexistuje:text' } }, NOW),
      'VALIDATION',
      'Označený text nesedí.',
    );
    await expectDomainError(
      createComment(w.db, w.honza, { ...base, anchor: { ...good, from: -1, to: 3 } }, NOW),
      'VALIDATION',
      'Označený text nesedí.',
    );
    await expectDomainError(createComment(w.db, w.honza, { ...base, suggestion: { replacement: 'a' } }, NOW), 'VALIDATION');
    await expectDomainError(createComment(w.db, w.honza, { ...base, body: '  ' }, NOW), 'VALIDATION');
    await expectDomainError(createComment(w.db, w.honza, { ...base, type: 'nonsense' as never }, NOW), 'VALIDATION');
    await expectDomainError(createComment(w.db, w.honza, { ...base, mentions: ['nobody'] }, NOW), 'VALIDATION');
    await expectDomainError(createComment(w.db, w.honza, { ...base, videoId: 'nope' }, NOW), 'NOT_FOUND', 'Scénář nenalezen.');
    await expectDomainError(
      createComment(w.db, { id: 'p', role: 'production', name: 'P' }, base, NOW),
      'FORBIDDEN',
    );
  });

  it('only on the latest version; null version only before the first submission', async () => {
    const { videoId, versionId } = await createSubmitted(w);
    await w.db.update(s.videos).set({ approvalStatus: 'returned' }).where(eq(s.videos.id, videoId));
    const { submitForReview } = await import('@/server/videos');
    await submitForReview(w.db, w.admin, videoId, {}, NOW);
    await expectDomainError(
      createComment(w.db, w.honza, { videoId, versionId, type: 'remark', body: 'x' }, NOW),
      'STALE',
      'Mezitím vznikla nová verze.',
    );
    await expectDomainError(
      createComment(w.db, w.honza, { videoId, versionId: null, type: 'remark', body: 'x' }, NOW),
      'VALIDATION',
    );

    // before any version: anchors are checked against the draft
    const { id: fresh } = await createVideo(w.db, w.admin, { title: 'Bez verze' }, NOW);
    await saveDraft(w.db, w.admin, fresh, w.cleanBody(), NOW);
    const { id } = await createComment(
      w.db,
      w.admin,
      { videoId: fresh, versionId: null, type: 'remark', body: 'x', anchor: anchorIn(w.cleanBody(), LINE, 'sázka') },
      NOW,
    );
    expect((await getComment(w.db, id)).versionId).toBeNull();
    await expectDomainError(
      createComment(w.db, w.admin, { videoId: fresh, versionId: 'bogus', type: 'remark', body: 'x' }, NOW),
      'NOT_FOUND',
      'Verze nenalezena.',
    );
    // a version of another video does not belong to this one
    const other = await createSubmitted(w);
    await expectDomainError(
      createComment(w.db, w.admin, { videoId, versionId: other.versionId, type: 'remark', body: 'x' }, NOW),
      'NOT_FOUND',
      'Verze nenalezena.',
    );
  });
});

describe('replyToComment', () => {
  it('replies attach to the root, are remarks, and notify root author + owner', async () => {
    const { videoId, versionId } = await createSubmitted(w);
    const { id: root } = await createComment(w.db, w.honza, { videoId, versionId, type: 'remark', body: 'Root' }, NOW);
    const { id: r1 } = await replyToComment(w.db, w.radek, { parentId: root, body: 'Odpověď' }, NOW);
    const { id: r2 } = await replyToComment(w.db, w.admin, { parentId: r1, body: 'Odpověď na odpověď', mentions: [w.radek.id] }, NOW);

    expect(await getComment(w.db, r1)).toMatchObject({ parentId: root, videoId, versionId, type: 'remark', status: 'open', authorId: w.radek.id, anchor: null });
    expect((await getComment(w.db, r2)).parentId).toBe(root);

    const logs = await activityFor(w.db, videoId, 'comment.replied');
    expect(logs).toHaveLength(2);
    expect(await notifiedUsers(w.db, logs[0].id)).toEqual([w.honza.id, w.admin.id].sort());
    expect(await notifiedUsers(w.db, logs[1].id)).toEqual([w.honza.id, w.radek.id].sort());
  });

  it('validates', async () => {
    await expectDomainError(replyToComment(w.db, w.honza, { parentId: 'nope', body: 'x' }, NOW), 'NOT_FOUND', 'Komentář nenalezen.');
    const { videoId, versionId } = await createSubmitted(w);
    const { id } = await createComment(w.db, w.honza, { videoId, versionId, type: 'remark', body: 'R' }, NOW);
    await expectDomainError(replyToComment(w.db, w.honza, { parentId: id, body: ' ' }, NOW), 'VALIDATION');
  });
});

async function suggestion(opts: { author?: 'honza' | 'admin' } = {}) {
  const { videoId, versionId } = await createSubmitted(w);
  const author = opts.author === 'admin' ? w.admin : w.honza;
  const { id } = await createComment(
    w.db,
    author,
    {
      videoId,
      versionId,
      type: 'change_request',
      body: 'Přeformulovat',
      anchor: anchorIn(w.cleanBody(), LINE, 'nejdražší'),
      suggestion: { replacement: 'největší' },
    },
    NOW,
  );
  return { videoId, versionId, id };
}

const lineText = (body: { scenes: { lines: { id: string; text: string }[] }[] } | null, id = LINE) =>
  body?.scenes.flatMap((sc) => sc.lines).find((l) => l.id === id)?.text;

describe('decideSuggestion', () => {
  it('accept applies the replacement to the draft, addresses the comment, logs and notifies the author', async () => {
    const { videoId, id } = await suggestion();
    await decideSuggestion(w.db, w.admin, { commentId: id, accept: true }, minutesLater(1));

    const video = await getVideo(w.db, videoId);
    expect(lineText(video.draft)).toBe('To je ta největší sázka v dějinách.');
    expect(video.approvalStatus).toBe('in_review');
    const comment = await getComment(w.db, id);
    expect(comment.status).toBe('addressed');
    expect(comment.suggestion).toMatchObject({ state: 'accepted', decidedBy: w.admin.id, decidedAt: minutesLater(1).toISOString() });
    expect(comment.anchor).toMatchObject({ quotedText: 'největší', state: 'attached' });
    expect(comment.anchor?.to).toBe(comment.anchor!.from + 'největší'.length);

    const [log] = await activityFor(w.db, videoId, 'suggestion.accepted');
    expect(log).toMatchObject({ actorId: w.admin.id, entity: 'comment', entityId: id });
    expect(await notifiedUsers(w.db, log.id)).toEqual([w.honza.id]);
    // no new version for an unapproved script
    expect(await w.db.select().from(s.scriptVersions).where(eq(s.scriptVersions.videoId, videoId))).toHaveLength(1);
  });

  it('accept re-locates the quote when text before it changed (never splices at old offsets)', async () => {
    const { videoId, id } = await suggestion();
    await saveDraft(w.db, w.admin, videoId, withLineText(w.cleanBody(), LINE, 'Hele, to je ta nejdražší sázka v dějinách.'), NOW);
    await decideSuggestion(w.db, w.admin, { commentId: id, accept: true }, NOW);
    expect(lineText((await getVideo(w.db, videoId)).draft)).toBe('Hele, to je ta největší sázka v dějinách.');
  });

  it('accept after the quoted text was edited is STALE and changes nothing (Review Focus 1)', async () => {
    const { videoId, id } = await suggestion();
    const edited = withLineText(w.cleanBody(), LINE, 'To je ta pěkná sázka v dějinách.');
    await saveDraft(w.db, w.admin, videoId, edited, NOW);
    await expectDomainError(
      decideSuggestion(w.db, w.admin, { commentId: id, accept: true }, NOW),
      'STALE',
      'Text se mezitím změnil, návrh nelze použít automaticky.',
    );
    expect((await getVideo(w.db, videoId)).draft).toEqual(edited);
    const comment = await getComment(w.db, id);
    expect(comment.status).toBe('open');
    expect(comment.suggestion).toMatchObject({ state: 'pending' });
    expect(await activityFor(w.db, videoId, 'suggestion.accepted')).toHaveLength(0);
  });

  it('reject requires a reason, adds it as a reply, marks the suggestion rejected and the comment addressed', async () => {
    const { videoId, id } = await suggestion();
    await expectDomainError(decideSuggestion(w.db, w.admin, { commentId: id, accept: false }, NOW), 'VALIDATION', 'Napiš důvod odmítnutí.');
    await expectDomainError(decideSuggestion(w.db, w.admin, { commentId: id, accept: false, reason: '  ' }, NOW), 'VALIDATION');

    const draftBefore = (await getVideo(w.db, videoId)).draft;
    await decideSuggestion(w.db, w.admin, { commentId: id, accept: false, reason: 'Slovo je záměrné.' }, minutesLater(2));
    const comment = await getComment(w.db, id);
    expect(comment.status).toBe('addressed');
    expect(comment.suggestion).toMatchObject({ state: 'rejected', decidedBy: w.admin.id, reason: 'Slovo je záměrné.' });
    expect((await getVideo(w.db, videoId)).draft).toEqual(draftBefore);

    const replies = await w.db.select().from(s.comments).where(eq(s.comments.parentId, id));
    expect(replies).toHaveLength(1);
    expect(replies[0]).toMatchObject({ body: 'Slovo je záměrné.', authorId: w.admin.id, type: 'remark' });

    const [log] = await activityFor(w.db, videoId, 'suggestion.rejected');
    expect(log).toMatchObject({ actorId: w.admin.id, entityId: id });
    expect(await notifiedUsers(w.db, log.id)).toEqual([w.honza.id]);
  });

  it('only a pending suggestion by an authorised user can be decided', async () => {
    const { id } = await suggestion();
    await expectDomainError(decideSuggestion(w.db, w.honza, { commentId: id, accept: true }, NOW), 'FORBIDDEN');
    await decideSuggestion(w.db, w.admin, { commentId: id, accept: true }, NOW);
    await expectDomainError(decideSuggestion(w.db, w.admin, { commentId: id, accept: true }, NOW), 'VALIDATION');

    const { videoId, versionId } = await createSubmitted(w);
    const { id: plain } = await createComment(w.db, w.honza, { videoId, versionId, type: 'remark', body: 'x' }, NOW);
    await expectDomainError(decideSuggestion(w.db, w.admin, { commentId: plain, accept: true }, NOW), 'VALIDATION');
    await expectDomainError(decideSuggestion(w.db, w.admin, { commentId: 'nope', accept: true }, NOW), 'NOT_FOUND');
  });

  async function approvedWithSuggestion(author: 'honza' | 'admin') {
    const { videoId, versionId, id } = await suggestion({ author });
    await decide(w.db, w.honza, { videoId, versionId, decision: 'approve', overrideWarnings: true }, minutesLater(1));
    await decide(w.db, w.radek, { videoId, versionId, decision: 'approve', overrideWarnings: true }, minutesLater(2));
    expect((await getVideo(w.db, videoId)).approvalStatus).toBe('approved');
    return { videoId, versionId, id };
  }

  it('accepting a leadership suggestion on an approved script creates a version with copied decisions and stays approved', async () => {
    const { videoId, versionId, id } = await approvedWithSuggestion('honza');
    const approvedAt = (await getVideo(w.db, videoId)).approvedAt;

    await decideSuggestion(w.db, w.admin, { commentId: id, accept: true }, minutesLater(10));

    const video = await getVideo(w.db, videoId);
    expect(video).toMatchObject({ approvalStatus: 'approved', approvedBy: ['Honza', 'Radek'], editingAfterApproval: false });
    expect(video.approvedAt).toEqual(approvedAt);
    expect(lineText(video.draft)).toBe('To je ta největší sázka v dějinách.');

    const versions = await w.db.select().from(s.scriptVersions).where(eq(s.scriptVersions.videoId, videoId));
    expect(versions.map((v) => v.versionNo).sort()).toEqual([1, 2]);
    const v2 = versions.find((v) => v.versionNo === 2)!;
    expect(v2).toMatchObject({ origin: 'accepted_suggestions', createdBy: w.admin.id, changeSummary: 'Přijatý návrh změny' });
    expect(v2.body).toEqual(video.draft);
    expect(v2.meta).toMatchObject({ title: 'Testovací scénář' });

    const old = await w.db.select().from(s.approvalDecisions).where(eq(s.approvalDecisions.versionId, versionId));
    const copied = await w.db.select().from(s.approvalDecisions).where(eq(s.approvalDecisions.versionId, v2.id));
    expect(copied.map((d) => [d.userId, d.decision, d.overrodeWarnings]).sort()).toEqual(
      old.map((d) => [d.userId, d.decision, d.overrodeWarnings]).sort(),
    );
    expect(copied).toHaveLength(2);
    expect(new Set([...old, ...copied].map((d) => d.id)).size).toBe(4);
    expect((await getComment(w.db, id)).status).toBe('addressed');

    const [log] = await activityFor(w.db, videoId, 'suggestion.accepted');
    expect(log).toMatchObject({ actorId: w.admin.id, entity: 'comment', entityId: id });
    expect(log.after).toMatchObject({ versionNo: 2, versionId: v2.id, replacement: 'největší' });
  });

  it('the new version is built from the approved body, never from the draft', async () => {
    const { videoId, versionId, id } = await approvedWithSuggestion('honza');
    // Defensive: even a draft that diverged behind the lock's back must not leak into the new version.
    await w.db
      .update(s.videos)
      .set({ draft: { ...w.cleanBody(), caption: 'NEPOSOUZENÝ TEXT' } })
      .where(eq(s.videos.id, videoId));

    await decideSuggestion(w.db, w.admin, { commentId: id, accept: true }, minutesLater(10));

    const versions = await w.db.select().from(s.scriptVersions).where(eq(s.scriptVersions.videoId, videoId));
    const v2 = versions.find((v) => v.versionNo === 2)!;
    expect(v2.body.caption).not.toBe('NEPOSOUZENÝ TEXT');
    expect(v2.body.caption).toBe(w.cleanBody().caption);
    expect(lineText(v2.body)).toBe('To je ta největší sázka v dějinách.');
    const video = await getVideo(w.db, videoId);
    expect(video.draft).toEqual(v2.body);
    expect(video.approvalStatus).toBe('approved');
    expect(versions.find((v) => v.id === versionId)!.body).toEqual(w.cleanBody());
  });

  it('a draft edited during review leaves the script unlocked: accepting changes the draft only, no new version', async () => {
    const { videoId, versionId, id } = await suggestion();
    await saveDraft(w.db, w.admin, videoId, { ...w.cleanBody(), caption: 'NEPOSOUZENÝ TEXT' }, NOW);
    await decide(w.db, w.honza, { videoId, versionId, decision: 'approve', overrideWarnings: true }, NOW);
    await decide(w.db, w.radek, { videoId, versionId, decision: 'approve', overrideWarnings: true }, NOW);
    expect(await getVideo(w.db, videoId)).toMatchObject({ approvalStatus: 'approved', editingAfterApproval: true });

    await decideSuggestion(w.db, w.admin, { commentId: id, accept: true }, NOW);

    const versions = await w.db.select().from(s.scriptVersions).where(eq(s.scriptVersions.videoId, videoId));
    expect(versions).toHaveLength(1);
    expect(versions[0].body).toEqual(w.cleanBody());
    const video = await getVideo(w.db, videoId);
    expect(video).toMatchObject({ approvalStatus: 'approved', editingAfterApproval: true });
    expect(video.draft?.caption).toBe('NEPOSOUZENÝ TEXT');
    expect(lineText(video.draft)).toBe('To je ta největší sázka v dějinách.');
    expect(await activityFor(w.db, videoId, 'suggestion.accepted')).toHaveLength(1);
  });

  it('on an approved, locked script a non-leadership suggestion cannot change the draft; after unlock it can', async () => {
    const { videoId, id } = await approvedWithSuggestion('admin');
    await expectDomainError(
      decideSuggestion(w.db, w.admin, { commentId: id, accept: true }, NOW),
      'INVALID_TRANSITION',
      'Schválený scénář je zamčený. Nejdřív ho odemkni.',
    );
    await unlockForEdit(w.db, w.admin, videoId, NOW);
    await decideSuggestion(w.db, w.admin, { commentId: id, accept: true }, NOW);
    const video = await getVideo(w.db, videoId);
    expect(video.approvalStatus).toBe('approved');
    expect(lineText(video.draft)).toBe('To je ta největší sázka v dějinách.');
    expect(await w.db.select().from(s.scriptVersions).where(eq(s.scriptVersions.videoId, videoId))).toHaveLength(1);
  });

  it('remaps the anchors of other open comments when an accepted suggestion creates a version', async () => {
    const { videoId, versionId, id } = await approvedWithSuggestion('honza');
    const tail = anchorIn(w.cleanBody(), LINE, 'v dějinách');
    const { id: other } = await createComment(w.db, w.radek, { videoId, versionId, type: 'remark', body: 'x', anchor: tail }, NOW);
    await decideSuggestion(w.db, w.admin, { commentId: id, accept: true }, NOW);
    const shift = 'největší'.length - 'nejdražší'.length;
    expect((await getComment(w.db, other)).anchor).toMatchObject({ from: tail.from + shift, state: 'attached' });
  });
});

describe('comment status changes', () => {
  async function open() {
    const { videoId, versionId } = await createSubmitted(w);
    const { id } = await createComment(w.db, w.honza, { videoId, versionId, type: 'remark', body: 'x' }, NOW);
    return { videoId, id };
  }

  it('addressed → closed → reopened with activity and notifications', async () => {
    const { videoId, id } = await open();

    await markAddressed(w.db, w.admin, { commentId: id }, minutesLater(1));
    expect((await getComment(w.db, id)).status).toBe('addressed');
    const [addr] = await activityFor(w.db, videoId, 'comment.addressed');
    expect(addr.before).toMatchObject({ status: 'open' });
    expect(addr.after).toMatchObject({ status: 'addressed' });
    expect(await notifiedUsers(w.db, addr.id)).toEqual([w.honza.id]);

    await closeComment(w.db, w.honza, { commentId: id }, minutesLater(2));
    expect((await getComment(w.db, id)).status).toBe('closed');
    const [closed] = await activityFor(w.db, videoId, 'comment.closed');
    expect(await notifiedUsers(w.db, closed.id)).toEqual([w.admin.id]);

    await reopenComment(w.db, w.radek, { commentId: id }, minutesLater(3));
    expect((await getComment(w.db, id)).status).toBe('open');
    expect(await activityFor(w.db, videoId, 'comment.reopened')).toHaveLength(1);
  });

  it('checks permissions, transitions and root-only', async () => {
    const { id, videoId } = await open();
    await expectDomainError(markAddressed(w.db, w.honza, { commentId: id }, NOW), 'FORBIDDEN');
    await expectDomainError(closeComment(w.db, w.admin, { commentId: id }, NOW), 'FORBIDDEN');
    await expectDomainError(reopenComment(w.db, w.admin, { commentId: id }, NOW), 'FORBIDDEN');
    await expectDomainError(reopenComment(w.db, w.honza, { commentId: id }, NOW), 'INVALID_TRANSITION');
    await markAddressed(w.db, w.admin, { commentId: id }, NOW);
    await expectDomainError(markAddressed(w.db, w.admin, { commentId: id }, NOW), 'INVALID_TRANSITION');
    await expectDomainError(markAddressed(w.db, w.admin, { commentId: 'nope' }, NOW), 'NOT_FOUND', 'Komentář nenalezen.');
    const { id: reply } = await replyToComment(w.db, w.radek, { parentId: id, body: 'r' }, NOW);
    await expectDomainError(closeComment(w.db, w.honza, { commentId: reply }, NOW), 'VALIDATION');
    expect(await activityFor(w.db, videoId, 'comment.closed')).toHaveLength(0);
  });
});
