import { eq, inArray } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as s from '@/db/schema';
import { newId } from '@/domain/ids';
import { signDeepLink, signCrewLink, verifyCrewLink, verifyDeepLink, CREW_LINK_DAYS } from '@/server/auth/token';
import { signSession, verifySession } from '@/server/auth/jwt';
import { createCrewLink, loadCrewPackage, loadShootingDay, setProductionStatus } from '@/server/shooting';
import { describeActivity } from '@/server/activityText';
import { expectDomainError, NOW, setupWorld, type World } from './helpers';

const SECRET = 'test-secret-test-secret-test-secret-12345';
const DAY = 24 * 60 * 60 * 1000;

let w: World;
const idOf = async (code: string) => (await w.db.select({ id: s.videos.id }).from(s.videos).where(eq(s.videos.code, code)))[0].id;
const rowOf = async (code: string) => (await w.db.select().from(s.videos).where(eq(s.videos.code, code)))[0];

beforeAll(async () => {
  w = await setupWorld();
}, 60_000);

describe('crew link token', () => {
  it('round-trips the cycle id for 14 days and is not a session or a deep link', async () => {
    const token = await signCrewLink('2026-11', SECRET, NOW);
    expect(await verifyCrewLink(token, SECRET, NOW)).toEqual({ cycleId: '2026-11' });
    expect(await verifyCrewLink(token, SECRET, new Date(NOW.getTime() + (CREW_LINK_DAYS - 1) * DAY))).toEqual({ cycleId: '2026-11' });
    expect(await verifyCrewLink(token, SECRET, new Date(NOW.getTime() + (CREW_LINK_DAYS + 1) * DAY))).toBeNull();
    expect(await verifyCrewLink(token, 'another-secret-another-secret-123456', NOW)).toBeNull();
    expect(await verifyCrewLink(`${token}x`, SECRET, NOW)).toBeNull();
    expect(await verifyCrewLink('', SECRET, NOW)).toBeNull();
    // never a login
    expect(await verifySession(token, SECRET, NOW)).toBeNull();
    expect(await verifyDeepLink(token, SECRET, NOW)).toBeNull();
    // and other tokens are no crew links
    expect(await verifyCrewLink(await signSession('u1', SECRET, NOW), SECRET, NOW)).toBeNull();
    expect(await verifyCrewLink(await signDeepLink('u1', '/nataceni', SECRET, NOW), SECRET, NOW)).toBeNull();
  });
});

describe('setProductionStatus', () => {
  it('is for admin / production only and refuses scripts that are not approved', async () => {
    const v028 = await idOf('V028');
    await expectDomainError(setProductionStatus(w.db, w.honza, { videoIds: [v028], status: 'shot' }, NOW), 'FORBIDDEN');
    await expectDomainError(setProductionStatus(w.db, { ...w.admin, role: 'marketer' }, { videoIds: [v028], status: 'shot' }, NOW), 'FORBIDDEN');
    const error = await expectDomainError(setProductionStatus(w.db, w.admin, { videoIds: [v028], status: 'shot' }, NOW), 'VALIDATION');
    expect(error.message).toContain('V028 není schválený');
    expect((await rowOf('V028')).productionStatus).toBe('waiting');
    await expectDomainError(setProductionStatus(w.db, w.admin, { videoIds: [], status: 'shot' }, NOW), 'VALIDATION');
    await expectDomainError(setProductionStatus(w.db, w.admin, { videoIds: ['nope'], status: 'waiting' }, NOW), 'NOT_FOUND');
  });

  it('marks several approved scripts as shot on a date, logs it and refuses Publikováno without a publication', async () => {
    await w.db.update(s.videos).set({ approvalStatus: 'approved' }).where(inArray(s.videos.code, ['V028', 'V032']));
    const ids = [await idOf('V028'), await idOf('V032')];
    await setProductionStatus(w.db, w.admin, { videoIds: ids, status: 'shot', shotDate: '2026-11-20' }, NOW);
    for (const code of ['V028', 'V032']) {
      const row = await rowOf(code);
      expect(row.productionStatus).toBe('shot');
      expect(row.shotAt?.toISOString().slice(0, 10)).toBe('2026-11-20');
    }
    const log = await w.db.select().from(s.activityLog).where(eq(s.activityLog.entityId, ids[0]));
    expect(log.map((l) => l.action)).toContain('production.status_changed');

    await expectDomainError(setProductionStatus(w.db, w.admin, { videoIds: [ids[0]], status: 'published' }, NOW), 'VALIDATION', 'V028: stav Publikováno vyžaduje alespoň jednu publikaci.');
    await w.db.insert(s.publications).values({ id: newId(), videoId: ids[0], profileKey: 'radek', publishedAt: NOW, url: '' });
    await setProductionStatus(w.db, w.admin, { videoIds: [ids[0]], status: 'published' }, NOW);
    expect((await rowOf('V028')).productionStatus).toBe('published');

    await setProductionStatus(w.db, w.admin, { videoIds: [ids[1]], status: 'not_shot' }, NOW);
    expect(await rowOf('V032')).toMatchObject({ productionStatus: 'not_shot', shotAt: null });
    await expectDomainError(setProductionStatus(w.db, w.admin, { videoIds: ids, status: 'shot', shotDate: 'včera' }, NOW), 'VALIDATION');
  });

  it('has a Czech activity text', () => {
    const text = describeActivity(
      { action: 'production.status_changed', actorId: null, entityId: 'x', videoCode: 'V028', after: { code: 'V028', status: 'shot' } },
      new Map(),
    );
    expect(text.text).toBe('Systém změnil stav výroby V028 na Natočeno');
  });
});

describe('loadShootingDay', () => {
  it('counts down to the shoot and the approval deadline and groups the approved scripts', async () => {
    const day = await loadShootingDay(w.db, undefined, NOW);
    expect(day).not.toBeNull();
    expect(day!.cycle).toMatchObject({ id: '2026-11', shootDate: '2026-11-20', approvalDeadline: '2026-11-13', daysToShoot: 22, daysToDeadline: 15, clipTarget: '30–40' });
    const codes = day!.groups.flatMap((g) => g.castGroups.flatMap((c) => c.items.map((i) => i.code)));
    expect(codes.sort()).toEqual(['V020', 'V021', 'V028', 'V032']);
    expect(day!.approvedCount).toBe(4);
    expect(day!.warnings.join(' ')).toContain('Chybí schválené scénáře');
    expect(day!.warnings.join(' ')).not.toContain('Termín schválení už uplynul');
    expect(day!.groups[0].castGroups[0].items[0].hooks.length).toBeGreaterThan(0);
  });

  it('warns about unapproved scripts after the deadline and falls back for an unknown cycle', async () => {
    const day = await loadShootingDay(w.db, 'neexistuje', new Date('2026-11-15T10:00:00+01:00'));
    expect(day!.cycle.id).toBe('2026-11');
    expect(day!.cycle.daysToDeadline).toBe(-2);
    expect(day!.warnings[0]).toContain('Termín schválení už uplynul');
  });
});

describe('crew link package', () => {
  it('is created by an admin and shows hooks and spoken lines only', async () => {
    await expectDomainError(createCrewLink(w.db, w.honza, '2026-11', SECRET, NOW), 'FORBIDDEN');
    await expectDomainError(createCrewLink(w.db, w.admin, '2030-01', SECRET, NOW), 'NOT_FOUND');
    const { token } = await createCrewLink(w.db, w.admin, '2026-11', SECRET, NOW);
    const pack = await loadCrewPackage(w.db, token, SECRET, NOW);
    expect(pack).not.toBeNull();
    expect(pack!.cycleId).toBe('2026-11');
    const items = pack!.groups.flatMap((g) => g.castGroups.flatMap((c) => c.items));
    expect(items.map((i) => i.code).sort()).toEqual(['V020', 'V021', 'V028', 'V032']);
    const first = items[0];
    expect(first.lines.length).toBeGreaterThan(0);
    expect(first.lines[0]).toHaveProperty('speaker');
    const json = JSON.stringify(pack);
    expect(json).not.toContain('comment');
    expect(json).not.toContain('leadershipNote');
    expect(json).not.toContain('caption');
    expect(await loadCrewPackage(w.db, token, SECRET, new Date(NOW.getTime() + 15 * DAY))).toBeNull();
    expect(await loadCrewPackage(w.db, 'blbost', SECRET, NOW)).toBeNull();
  });
});
