import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as s from '@/db/schema';
import { describeActivity } from '@/server/activityText';
import { decide } from '@/server/approvals';
import {
  getDashboard,
  getReviewQueue,
  getVideoDetail,
  listNotifications,
  listVideos,
  markNotificationRead,
  markSeen,
  unreadCount,
} from '@/server/queries';
import { createSubmitted, expectDomainError, minutesLater, NOW, setupWorld, type World } from './helpers';

let w: World;
const idOf = async (code: string) => (await w.db.select().from(s.videos).where(eq(s.videos.code, code)))[0].id;

beforeAll(async () => {
  w = await setupWorld();
});

describe('listVideos', () => {
  it('lists all demo videos by code with counts, cast and duration', async () => {
    const list = await listVideos(w.db, w.admin, {});
    expect(list.map((v) => v.code)).toEqual(['V026', 'V028', 'V031', 'V032', 'V033', 'V036']);
    const v031 = list.find((v) => v.code === 'V031')!;
    expect(v031).toMatchObject({
      title: 'Klient s chybou: fixace hypotéky',
      categoryKey: 'produkt',
      approvalStatus: 'final_review',
      productionStatus: 'waiting',
      cycleId: '2026-11',
      plannedMonth: '2026-11',
      durationSec: 21,
      openComments: 2,
      latestVersionNo: 2,
    });
    expect(list.find((v) => v.code === 'V036')).toMatchObject({ latestVersionNo: null, openComments: 0 });
  });

  it('derives the cast initials from the script speakers', async () => {
    const byCode = Object.fromEntries((await listVideos(w.db, w.admin, {})).map((v) => [v.code, v.castInitials]));
    expect(byCode.V031).toBe('R + H');
    expect(byCode.V026).toBe('H + R'); // order of appearance
    expect(byCode.V028).toBe('Honza'); // exactly one leader
    expect(byCode.V032).toBe('Honza'); // "Radek obchodník" is not a profile speaker
  });

  it('filters by status, category, cycle, month and text (accent and case insensitive)', async () => {
    const codes = async (f: Parameters<typeof listVideos>[2]) => (await listVideos(w.db, w.admin, f)).map((v) => v.code);
    expect(await codes({ approvalStatus: 'in_review' })).toEqual(['V028', 'V032', 'V033']);
    expect(await codes({ categoryKey: 'lifestyle' })).toEqual(['V028', 'V036']);
    expect(await codes({ cycleId: '2026-11', productionStatus: 'waiting' })).toHaveLength(6);
    expect(await codes({ cycleId: 'nope' })).toEqual([]);
    expect(await codes({ plannedMonth: '2026-11' })).toHaveLength(6);
    expect(await codes({ q: 'PET radku' })).toEqual(['V032']);
    expect(await codes({ q: 'fixace' })).toEqual(['V031']);
    expect(await codes({ q: 'v033' })).toEqual(['V033']);
  });
});

describe('getReviewQueue', () => {
  it('orders undecided first, then by code, and moves a decided script to the end for that leader only', async () => {
    const before = await getReviewQueue(w.db, w.honza, {});
    expect(before.map((i) => i.code)).toEqual(['V026', 'V028', 'V031', 'V032', 'V033']);
    expect(before.every((i) => !i.decidedByActor)).toBe(true);
    expect(before.find((i) => i.code === 'V026')).toMatchObject({
      versionNo: 2,
      isFinal: true,
      openComments: 0,
      title: 'Dva šéfové, jeden problém',
    });
    expect(before.find((i) => i.code === 'V032')).toMatchObject({ versionNo: 1, isFinal: false });
    expect(before.find((i) => i.code === 'V031')?.openComments).toBe(2);

    await decide(w.db, w.honza, { videoId: await idOf('V026'), versionId: 'sample-v026-v2', decision: 'approve', overrideWarnings: true }, NOW);

    const honza = await getReviewQueue(w.db, w.honza, {});
    expect(honza.map((i) => i.code)).toEqual(['V028', 'V031', 'V032', 'V033', 'V026']);
    expect(honza.map((i) => i.decidedByActor)).toEqual([false, false, false, false, true]);

    const radek = await getReviewQueue(w.db, w.radek, {});
    expect(radek.map((i) => i.code)).toEqual(['V026', 'V028', 'V031', 'V032', 'V033']);
    expect(radek.some((i) => i.decidedByActor)).toBe(false);

    expect((await getReviewQueue(w.db, w.honza, { cycleId: 'nope' }))).toEqual([]);
    expect((await getReviewQueue(w.db, w.admin, {})).map((i) => i.code)).toHaveLength(5);
  });
});

describe('getDashboard', () => {
  it('computes cycle numbers, counters, kanban and latest open comments for Honza', async () => {
    const world = await setupWorld(); // fresh, undecided
    const d = await getDashboard(world.db, world.honza, new Date('2026-10-29T10:00:00+01:00'));
    expect(d.awaitingMe).toBe(5);
    expect(d.returnedToMe).toBe(0);
    expect(d.cycle).toMatchObject({
      id: '2026-11',
      shootDate: '2026-11-20',
      approvalDeadline: '2026-11-13',
      daysToShoot: 22,
      daysToDeadline: 15,
      clipTarget: '30–40',
      locations: [],
      approvedCount: 0,
    });
    expect(Object.keys(d.kanban).sort()).toEqual(
      ['approved', 'cancelled', 'draft', 'final_review', 'in_review', 'postponed', 'returned'].sort(),
    );
    expect(d.kanban.in_review.map((v) => v.code)).toEqual(['V028', 'V032', 'V033']);
    expect(d.kanban.final_review.map((v) => v.code)).toEqual(['V026', 'V031']);
    expect(d.kanban.draft.map((v) => v.code)).toEqual(['V036']);
    expect(d.kanban.approved).toEqual([]);
    expect(d.openCommentsTotal).toBe(2);
    expect(d.openComments).toEqual([
      expect.objectContaining({ videoCode: 'V031', author: 'Radek', typeLabel: 'Odborné doplnění' }),
      expect.objectContaining({ videoCode: 'V031', author: 'Honza', typeLabel: 'Požadavek na úpravu' }),
    ]);
  });

  it('shows no awaiting count for admin and counts returned scripts for their owner', async () => {
    const world = await setupWorld();
    const now = new Date('2026-10-29T10:00:00+01:00');
    expect((await getDashboard(world.db, world.admin, now)).awaitingMe).toBe(0);
    await decide(world.db, world.radek, { videoId: await idOfIn(world, 'V032'), versionId: 'sample-v032-v1', decision: 'return', note: 'Moc dlouhé.' }, now);
    const d = await getDashboard(world.db, world.admin, now);
    expect(d.returnedToMe).toBe(1);
    expect(d.kanban.returned.map((v) => v.code)).toEqual(['V032']);
  });

  it('picks the latest cycle when all shoots are in the past and null without cycles', async () => {
    const world = await setupWorld();
    const d = await getDashboard(world.db, world.honza, new Date('2027-01-10T10:00:00+01:00'));
    expect(d.cycle).toMatchObject({ id: '2026-11', daysToShoot: -51 });
    await world.db.update(s.videos).set({ cycleId: null });
    await world.db.delete(s.shootingCycles);
    const none = await getDashboard(world.db, world.honza, NOW);
    expect(none.cycle).toBeNull();
    expect(none.kanban.draft).toEqual([]);
  });
});

async function idOfIn(world: World, code: string) {
  return (await world.db.select().from(s.videos).where(eq(s.videos.code, code)))[0].id;
}

describe('getVideoDetail', () => {
  it('returns versions, threads with replies, approval state, checks and activity', async () => {
    const detail = await getVideoDetail(w.db, w.honza, await idOf('V031'));
    expect(detail.video.code).toBe('V031');
    expect(detail.versions.map((v) => v.versionNo)).toEqual([1, 2]);
    expect(detail.latestVersion?.versionNo).toBe(2);
    expect(detail.decisions).toEqual([]);
    expect(detail.approval).toMatchObject({ policy: 'all_leadership', state: 'pending', decisions: [] });
    expect(detail.approval.waitingFor).toEqual(['Honza', 'Radek']);

    expect(detail.threads.map((t) => t.id)).toEqual(['sample-v031-c3', 'sample-v031-c2', 'sample-v031-c1']);
    expect(detail.threads.map((t) => t.index)).toEqual([1, 2, 3]);
    expect(detail.threads[0]).toMatchObject({ authorName: 'Honza', authorInitials: 'H', isDetached: false });
    expect(detail.threads[0].replies).toEqual([
      expect.objectContaining({ id: 'sample-v031-c3-reply', authorName: 'Admin', authorInitials: 'A' }),
    ]);
    expect(detail.threads[1].suggestion?.replacement).toBe('Počkej. Kolik ti nabídli jinde?');

    expect(detail.checks.length).toBeGreaterThan(5);
    expect(detail.numberChecks).toEqual([]);
    expect(detail.activity[0].createdAt.getTime()).toBeGreaterThanOrEqual(detail.activity.at(-1)!.createdAt.getTime());
    expect(detail.activity.at(-1)).toMatchObject({ actorName: 'Admin', text: expect.stringContaining('V031') });
    expect(detail.lastSeenVersionNo).toBeNull();
  });

  it('flags detached threads, includes decisions for the latest version only and falls back to the draft', async () => {
    const id = await idOf('V031');
    await w.db.update(s.comments).set({ anchor: { fieldId: 'caption', from: 0, to: 3, quotedText: 'xyz', state: 'detached' } }).where(eq(s.comments.id, 'sample-v031-c1'));
    const detail = await getVideoDetail(w.db, w.radek, id);
    expect(detail.threads.filter((t) => t.isDetached).map((t) => t.id)).toEqual(['sample-v031-c1']);

    // Seeded return decision belongs to v1; v2 has none.
    expect(detail.decisions).toHaveLength(0);

    const draftOnly = await getVideoDetail(w.db, w.admin, await idOf('V036'));
    expect(draftOnly.latestVersion).toBeNull();
    expect(draftOnly.versions).toEqual([]);
    expect(draftOnly.checks.length).toBeGreaterThan(5);
    expect(draftOnly.currentBody).toEqual(draftOnly.video.draft);
    expect(draftOnly.approval.waitingFor).toEqual([]);
  });

  it('reports leader decisions on the latest version and the waiting leader', async () => {
    const world = await setupWorld();
    const id = await idOfIn(world, 'V033');
    await decide(world.db, world.honza, { videoId: id, versionId: 'sample-v033-v1', decision: 'approve', note: 'Super', overrideWarnings: true }, NOW);
    const detail = await getVideoDetail(world.db, world.admin, id);
    expect(detail.approval.state).toBe('pending');
    expect(detail.approval.waitingFor).toEqual(['Radek']);
    expect(detail.approval.decisions).toEqual([
      expect.objectContaining({ userName: 'Honza', decision: 'approve', note: 'Super' }),
    ]);
    expect(detail.activity[0].text).toBe('Honza schválil V033 v1');
  });

  it('throws NOT_FOUND for an unknown video', async () => {
    await expectDomainError(getVideoDetail(w.db, w.admin, 'nope'), 'NOT_FOUND');
  });

  it('tracks the last seen version per user', async () => {
    const id = await idOf('V031');
    await markSeen(w.db, w.honza, { videoId: id, versionId: 'sample-v031-v1' }, NOW);
    expect((await getVideoDetail(w.db, w.honza, id)).lastSeenVersionNo).toBe(1);
    await markSeen(w.db, w.honza, { videoId: id, versionId: 'sample-v031-v2' }, minutesLater(5));
    expect((await getVideoDetail(w.db, w.honza, id)).lastSeenVersionNo).toBe(2);
    expect((await getVideoDetail(w.db, w.radek, id)).lastSeenVersionNo).toBeNull();
    await expectDomainError(markSeen(w.db, w.honza, { videoId: id, versionId: 'sample-v026-v1' }, NOW), 'NOT_FOUND');
  });
});

describe('describeActivity', () => {
  const names = new Map([
    ['a', 'Admin'],
    ['h', 'Honza'],
    ['r', 'Radek'],
  ]);
  const row = (action: string, actorId: string, after: Record<string, unknown> | null = null, entityId = 'e1') => ({
    action,
    actorId,
    entityId,
    videoCode: 'V031',
    after,
  });

  it('writes Czech sentences for the core events', () => {
    expect(describeActivity(row('version.submitted', 'a', { versionNo: 2 }), names).text).toBe('Admin odeslal V031 v2 ke kontrole');
    expect(describeActivity(row('approval.returned', 'r', { versionNo: 1 }), names).text).toBe('Radek vrátil V031 v1 k dopracování');
    expect(describeActivity(row('approval.approved', 'h', { versionNo: 2 }), names).text).toBe('Honza schválil V031 v2');
    expect(describeActivity(row('video.approved', 'r', { approvedBy: ['Honza', 'Radek'] }), names).text).toBe('V031 je schválený oběma');
    expect(describeActivity(row('video.approved', 'r', { approvedBy: ['Radek'] }), names).text).toBe('V031 je schválený');
    expect(describeActivity(row('comment.created', 'r', { type: 'remark' }), names).text).toBe('Radek okomentoval V031');
    expect(describeActivity(row('comment.created', 'h', { hasSuggestion: true }), names).text).toBe('Honza navrhl změnu ve V031');
    expect(describeActivity(row('comment.replied', 'a'), names).text).toBe('Admin odpověděl na komentář ve V031');
    expect(describeActivity(row('suggestion.accepted', 'a'), names).text).toBe('Admin přijal návrh ve V031');
    expect(describeActivity(row('suggestion.rejected', 'a'), names).text).toBe('Admin odmítl návrh ve V031');
    expect(describeActivity(row('comment.addressed', 'a'), names).text).toBe('Admin označil komentář jako zapracovaný ve V031');
    expect(describeActivity(row('comment.closed', 'h'), names).text).toBe('Honza uzavřel komentář ve V031');
    expect(describeActivity(row('comment.reopened', 'h'), names).text).toBe('Honza znovu otevřel komentář ve V031');
    expect(describeActivity(row('video.postponed', 'a'), names).text).toBe('Admin odložil V031');
  });

  it('describes the activity rows written by the demo seed', async () => {
    const detail = await getVideoDetail(w.db, w.admin, await idOf('V031'));
    const texts = detail.activity.map((a) => a.text);
    expect(texts).toContain('Admin odeslal V031 v2 ke kontrole');
    expect(texts).toContain('Radek vrátil V031 v1 k dopracování');
    expect(texts.some((t) => t.startsWith('Změna'))).toBe(false);
  });

  it('omits an unknown version number', () => {
    expect(describeActivity(row('approval.returned', 'r', { note: 'x' }), names).text).toBe('Radek vrátil V031 k dopracování');
  });

  it('links leadership to the review screen and everyone else to the script, with comment anchors', () => {
    const lead = { role: 'leadership' as const };
    const admin = { role: 'admin' as const };
    expect(describeActivity(row('version.submitted', 'a', { versionNo: 1 }), names, lead).href).toBe('/kontrola/V031');
    expect(describeActivity(row('version.submitted', 'a', { versionNo: 1 }), names, admin).href).toBe('/scenare/V031');
    expect(describeActivity(row('comment.created', 'r', {}, 'c9'), names, lead).href).toBe('/kontrola/V031#komentar-c9');
    expect(describeActivity(row('comment.created', 'r', {}, 'c9'), names, admin).href).toBe('/scenare/V031#komentar-c9');
    expect(describeActivity(row('approval.returned', 'r', { versionNo: 1 }), names, admin).href).toBe('/scenare/V031');
  });
});

describe('notifications', () => {
  it('lists Czech notifications newest first, counts and marks them read', async () => {
    const world = await setupWorld();
    const { code } = await createSubmitted(world, 'Notifikační test');
    const sub = await listNotifications(world.db, world.honza, { limit: 10 });
    expect(sub).toHaveLength(1);
    expect(sub[0]).toMatchObject({ text: `Admin odeslal ${code} v1 ke kontrole`, href: `/kontrola/${code}`, readAt: null });
    expect(await unreadCount(world.db, world.honza)).toBe(1);
    expect(await unreadCount(world.db, world.admin)).toBe(0);

    const videoId = await idOfIn(world, code);
    const [version] = await world.db.select().from(s.scriptVersions).where(eq(s.scriptVersions.videoId, videoId));
    await decide(world.db, world.radek, { videoId, versionId: version.id, decision: 'return', note: 'Přepsat hook.' }, minutesLater(10));
    const adminList = await listNotifications(world.db, world.admin, { limit: 10 });
    expect(adminList[0]).toMatchObject({ text: `Radek vrátil ${code} v1 k dopracování`, href: `/scenare/${code}` });

    await markNotificationRead(world.db, world.honza, sub[0].id, minutesLater(20));
    expect(await unreadCount(world.db, world.honza)).toBe(0);
    expect((await listNotifications(world.db, world.honza, { limit: 10 }))[0].readAt).toEqual(minutesLater(20));
    // Cannot touch someone else's notification.
    await markNotificationRead(world.db, world.radek, adminList[0].id, minutesLater(21));
    expect(await unreadCount(world.db, world.admin)).toBe(1);
    expect(await listNotifications(world.db, world.admin, { limit: 1 })).toHaveLength(1);
  });
});
