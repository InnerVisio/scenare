import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as s from '@/db/schema';
import { logActivity } from '@/server/activity';
import { NOW, setupWorld, type World } from './helpers';

describe('logActivity', () => {
  let w: World;
  let videoId: string;
  beforeAll(async () => {
    w = await setupWorld();
    const [v] = await w.db.select().from(s.videos).where(eq(s.videos.code, 'V036'));
    videoId = v.id;
  }, 60_000);

  const recipients = async (activityId: string) =>
    (await w.db.select().from(s.notifications).where(eq(s.notifications.activityId, activityId)))
      .map((n) => n.userId)
      .sort();

  const log = (
    actorId: string,
    action: string,
    entity: string,
    entityId: string,
    extra: { before?: Record<string, unknown>; after?: Record<string, unknown> } = {},
  ) =>
    w.db.transaction((tx) => logActivity(tx, { actorId, videoId, entity, entityId, action, ...extra }, NOW));

  it('writes the activity row with before/after and the given time', async () => {
    const id = await log(w.admin.id, 'video.meta_updated', 'video', videoId, { before: { a: 1 }, after: { a: 2 } });
    const [row] = await w.db.select().from(s.activityLog).where(eq(s.activityLog.id, id));
    expect(row).toMatchObject({
      actorId: w.admin.id,
      videoId,
      entity: 'video',
      entityId: videoId,
      action: 'video.meta_updated',
      before: { a: 1 },
      after: { a: 2 },
    });
    expect(row.createdAt.getTime()).toBe(NOW.getTime());
    expect(await recipients(id)).toEqual([]);
  });

  it('version.submitted notifies all leadership, never the actor', async () => {
    const id = await log(w.admin.id, 'version.submitted', 'script_version', 'ver');
    expect(await recipients(id)).toEqual([w.honza.id, w.radek.id].sort());
    const id2 = await log(w.honza.id, 'version.submitted', 'script_version', 'ver');
    expect(await recipients(id2)).toEqual([w.radek.id]);
  });

  it.each(['approval.approved', 'approval.returned', 'video.approved'])('%s notifies the video owner', async (action) => {
    const id = await log(w.honza.id, action, 'video', videoId);
    expect(await recipients(id)).toEqual([w.admin.id]);
    const own = await log(w.admin.id, action, 'video', videoId);
    expect(await recipients(own)).toEqual([]);
  });

  async function insertComment(id: string, authorId: string, extra: Partial<typeof s.comments.$inferInsert> = {}) {
    await w.db.insert(s.comments).values({ id, videoId, authorId, type: 'remark', body: 'x', ...extra });
  }

  it('comment.created notifies owner + mentions, de-duplicated, without actor', async () => {
    await insertComment('c-created', w.honza.id, { mentions: [w.radek.id, w.admin.id, w.honza.id] });
    const id = await log(w.honza.id, 'comment.created', 'comment', 'c-created');
    expect(await recipients(id)).toEqual([w.admin.id, w.radek.id].sort());
  });

  it('comment.replied notifies root author + owner + mentions', async () => {
    await insertComment('c-root', w.honza.id);
    await insertComment('c-reply', w.admin.id, { parentId: 'c-root', mentions: [w.radek.id] });
    const id = await log(w.admin.id, 'comment.replied', 'comment', 'c-reply');
    expect(await recipients(id)).toEqual([w.honza.id, w.radek.id].sort());
  });

  it.each(['suggestion.accepted', 'suggestion.rejected', 'comment.addressed'])(
    '%s notifies the root comment author',
    async (action) => {
      const id = await log(w.admin.id, action, 'comment', 'c-root');
      expect(await recipients(id)).toEqual([w.honza.id]);
    },
  );

  it.each(['comment.closed', 'comment.reopened'])('%s notifies the video owner', async (action) => {
    const id = await log(w.honza.id, action, 'comment', 'c-root');
    expect(await recipients(id)).toEqual([w.admin.id]);
  });

  it.each(['video.created', 'number.flagged', 'number.confirmed', 'video.postponed'])('%s notifies nobody', async (action) => {
    const id = await log(w.honza.id, action, 'video', videoId);
    expect(await recipients(id)).toEqual([]);
  });
});
