import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as s from '@/db/schema';
import { describeActivity } from '@/server/activityText';
import { createVideo, deleteVideo, saveDraft, submitForReview } from '@/server/videos';
import { COMPLETE_META, NOW, setupWorld, type World } from './helpers';

describe('deleteVideo', () => {
  let w: World;
  beforeAll(async () => {
    w = await setupWorld();
  }, 60_000);

  const count = async (table: typeof s.comments | typeof s.scriptVersions | typeof s.activityLog, videoId: string) =>
    (await w.db.select().from(table).where(eq(table.videoId, videoId))).length;

  it('removes the video and every row that references it, leaving other videos alone', async () => {
    const { id, code } = await createVideo(w.db, w.admin, { title: 'Ke smazání', ...COMPLETE_META }, NOW);
    await saveDraft(w.db, w.admin, id, w.cleanBody(), NOW);
    await submitForReview(w.db, w.admin, id, {}, NOW);
    const [version] = await w.db.select().from(s.scriptVersions).where(eq(s.scriptVersions.videoId, id));
    await w.db.insert(s.comments).values({ id: 'c-del', videoId: id, versionId: version.id, authorId: w.honza.id, type: 'comment', body: 'x', mentions: [] });
    await w.db.insert(s.approvalDecisions).values({ id: 'd-del', versionId: version.id, userId: w.radek.id, decision: 'return', note: '' });
    await w.db.insert(s.numberChecks).values({ id: 'n-del', videoId: id, fieldId: 'f', quotedText: '1' });
    await w.db.insert(s.publications).values({ id: 'p-del', videoId: id, profileKey: 'radek', publishedAt: NOW });
    await w.db.insert(s.viewMarks).values({ userId: w.honza.id, videoId: id });
    const [other] = await w.db.select().from(s.videos).where(eq(s.videos.code, 'V036'));
    const otherVersions = await count(s.scriptVersions, other.id);
    const otherActivity = await count(s.activityLog, other.id);

    await deleteVideo(w.db, w.admin, id, NOW);

    expect(await w.db.select().from(s.videos).where(eq(s.videos.id, id))).toHaveLength(0);
    for (const table of [s.comments, s.scriptVersions, s.activityLog, s.numberChecks, s.publications, s.viewMarks]) {
      expect(await w.db.select().from(table).where(eq(table.videoId, id))).toHaveLength(0);
    }
    expect(await w.db.select().from(s.approvalDecisions).where(eq(s.approvalDecisions.id, 'd-del'))).toHaveLength(0);
    expect(await count(s.scriptVersions, other.id)).toBe(otherVersions);
    expect(await count(s.activityLog, other.id)).toBe(otherActivity);

    const [log] = await w.db.select().from(s.activityLog).where(eq(s.activityLog.action, 'video.deleted'));
    expect(log.videoId).toBeNull();
    expect(describeActivity({ action: log.action, actorId: log.actorId, entityId: log.entityId, videoCode: null, after: log.after }, new Map([[w.admin.id, 'Admin']])).text).toBe(
      `Admin smazal ${code} „Ke smazání“`,
    );
  });

  it('is forbidden for everyone but the admin', async () => {
    const { id } = await createVideo(w.db, w.admin, { title: 'Moje' }, NOW);
    await expect(deleteVideo(w.db, w.honza, id, NOW)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(deleteVideo(w.db, w.radek, id, NOW)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(await w.db.select().from(s.videos).where(eq(s.videos.id, id))).toHaveLength(1);
  });
});
