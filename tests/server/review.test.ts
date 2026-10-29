import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as s from '@/db/schema';
import { decide } from '@/server/approvals';
import { markSeen } from '@/server/queries';
import { loadReview } from '@/server/review';
import { expectDomainError, NOW, setupWorld, type World } from './helpers';

let w: World;
beforeAll(async () => {
  w = await setupWorld();
});

describe('loadReview', () => {
  it('loads V031 for Radek with queue position, cycle deadline, threads and versions', async () => {
    const data = await loadReview(w.db, w.radek, 'V031', {}, NOW);
    expect(data.video).toMatchObject({ code: 'V031', status: 'final_review' });
    expect(data.latest?.no).toBe(2);
    expect(data.queue.map((q) => q.code)).toEqual(['V026', 'V028', 'V031', 'V032', 'V033']);
    expect(data.position).toBe(3);
    expect(data.prevCode).toBe('V028');
    expect(data.nextCode).toBe('V032');
    expect(data.queue[0].category).toMatchObject({ short: 'Nábor' });
    expect(data.cycle).toEqual({ id: '2026-11', shootDate: '2026-11-20', deadline: '2026-11-13', daysToDeadline: 15 });

    expect(data.threads.map((t) => [t.index, t.authorName, t.status])).toEqual([
      [1, 'Honza', 'addressed'],
      [2, 'Honza', 'open'],
      [3, 'Radek', 'open'],
    ]);
    expect(data.threads[0].replies).toHaveLength(1);
    expect(data.threads[1].suggestion).toMatchObject({ state: 'pending', replacement: 'Počkej. Kolik ti nabídli jinde?' });

    expect(data.versions.map((v) => [v.no, v.commentCount])).toEqual([[1, 0], [2, 3]]);
    expect(data.versions[0].decisions).toEqual([expect.objectContaining({ userName: 'Radek', decision: 'return' })]);
    expect(Object.keys(data.bodies)).toEqual(['1', '2']);
    expect(data.users.map((u) => u.name)).toEqual(['Admin', 'Honza']);
    expect(data.checks.length).toBeGreaterThan(5);
    expect(data.lastSeenVersionNo).toBeNull();
    expect(data.hasOwnCommentOnLatest).toBe(true);
  });

  it('gives leadership decide rights and admin comment-only rights', async () => {
    const radek = await loadReview(w.db, w.radek, 'V031', {}, NOW);
    expect(radek.perms).toMatchObject({ decide: true, comment: true, suggest: true, close: true, reopen: true, decideSuggestion: false, address: false });
    const admin = await loadReview(w.db, w.admin, 'V031', {}, NOW);
    expect(admin.perms).toMatchObject({ decide: false, comment: true, close: false, decideSuggestion: true, address: true, manualCheck: true });
  });

  it('reports approval progress and the actor having approved', async () => {
    const [v026] = await w.db.select().from(s.videos).where(eq(s.videos.code, 'V026'));
    const versionId = 'sample-v026-v2';
    await decide(w.db, w.honza, { videoId: v026.id, versionId, decision: 'approve', overrideWarnings: true }, NOW);

    const honza = await loadReview(w.db, w.honza, 'V026', {}, NOW);
    expect(honza.approval).toEqual({ state: 'pending', approvedNames: ['Honza'], waitingFor: ['Radek'], required: 2, actorApproved: true });
    const radek = await loadReview(w.db, w.radek, 'V026', {}, NOW);
    expect(radek.approval.actorApproved).toBe(false);
    // Items the actor already approved sort last in his queue.
    expect(honza.queue.at(-1)).toMatchObject({ code: 'V026', decidedByActor: true });
  });

  it('captures the last seen version before it is updated', async () => {
    const [v031] = await w.db.select().from(s.videos).where(eq(s.videos.code, 'V031'));
    await markSeen(w.db, w.honza, { videoId: v031.id, versionId: 'sample-v031-v1' }, NOW);
    expect((await loadReview(w.db, w.honza, 'V031', {}, NOW)).lastSeenVersionNo).toBe(1);
  });

  it('filters the queue by cycle and tolerates scripts outside the queue', async () => {
    expect((await loadReview(w.db, w.radek, 'V031', { cycleId: 'nope' }, NOW)).queue).toEqual([]);
    const draft = await loadReview(w.db, w.radek, 'V036', {}, NOW);
    expect(draft.position).toBeNull();
    expect(draft.prevCode).toBeNull();
    expect(draft.nextCode).toBeNull();
    expect(draft.latest).toBeNull();
    expect(draft.perms.decide).toBe(false);
  });

  it('throws NOT_FOUND for an unknown code', async () => {
    await expectDomainError(loadReview(w.db, w.radek, 'V999', {}, NOW), 'NOT_FOUND');
  });
});
