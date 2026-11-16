import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as s from '@/db/schema';
import { addShootingDay, deleteShootingDay, getSettings, updateShootingDay } from '@/server/settings';
import { loadShellData } from '@/server/shell';
import { expectDomainError, NOW, setupWorld, type World } from './helpers';

let w: World;
beforeAll(async () => {
  w = await setupWorld();
});

const row = async (id: string) => (await w.db.select().from(s.shootingCycles).where(eq(s.shootingCycles.id, id)))[0];

describe('shooting days', () => {
  it('adds a day with the date as id, defaults and a duplicate guard', async () => {
    await expectDomainError(addShootingDay(w.db, w.honza, { shootDate: '2026-12-10' }, NOW), 'FORBIDDEN');
    await expectDomainError(addShootingDay(w.db, w.admin, { shootDate: '2026-13-40' }, NOW), 'VALIDATION');
    const { id } = await addShootingDay(w.db, w.admin, { shootDate: '2026-12-10', note: 'Studio' }, NOW);
    expect(id).toBe('2026-12-10');
    expect(await row(id)).toMatchObject({
      shootDate: '2026-12-10',
      plannedVideos: (await getSettings(w.db)).monthlyTarget,
      coversMonths: ['2026-12'],
      note: 'Studio',
    });
    await expectDomainError(addShootingDay(w.db, w.admin, { shootDate: '2026-12-10' }, NOW), 'VALIDATION', 'Na tento den už natáčení je.');
  });

  it('updates fields but keeps the id', async () => {
    await addShootingDay(w.db, w.admin, { shootDate: '2026-12-17' }, NOW);
    await updateShootingDay(w.db, w.admin, '2026-12-17', { shootDate: '2026-12-18', plannedVideos: 5, note: 'Venku' }, NOW);
    expect(await row('2026-12-17')).toMatchObject({ shootDate: '2026-12-18', plannedVideos: 5, note: 'Venku', coversMonths: ['2026-12'] });
    await expectDomainError(updateShootingDay(w.db, w.admin, '2026-12-17', { shootDate: '2026-12-10' }, NOW), 'VALIDATION');
  });

  it('deletes a day and keeps its scripts in their month, or moves them', async () => {
    await expectDomainError(deleteShootingDay(w.db, w.honza, '2026-11', { moveTo: null }, NOW), 'FORBIDDEN');
    await addShootingDay(w.db, w.admin, { shootDate: '2026-12-24' }, NOW);
    await addShootingDay(w.db, w.admin, { shootDate: '2026-12-30' }, NOW);
    const [v1, v2] = await w.db.select({ id: s.videos.id }).from(s.videos).limit(2);
    await w.db.update(s.videos).set({ cycleId: '2026-12-24', plannedMonth: null }).where(eq(s.videos.id, v1.id));
    await w.db.update(s.videos).set({ cycleId: '2026-12-24', plannedMonth: null }).where(eq(s.videos.id, v2.id));
    const other = await w.db.select().from(s.videos).where(eq(s.videos.cycleId, '2026-11'));
    await expectDomainError(deleteShootingDay(w.db, w.admin, '2026-12-24', { moveTo: 'nope' }, NOW), 'VALIDATION');
    await deleteShootingDay(w.db, w.admin, '2026-12-24', { moveTo: null }, NOW);
    expect(await row('2026-12-24')).toBeUndefined();
    const kept = await w.db.select().from(s.videos).where(eq(s.videos.id, v1.id));
    expect(kept[0]).toMatchObject({ cycleId: null, plannedMonth: '2026-12' });
    expect(await row('2026-12-30')).toBeDefined();
    expect(await w.db.select().from(s.videos).where(eq(s.videos.cycleId, '2026-11'))).toHaveLength(other.length);

    await w.db.update(s.videos).set({ cycleId: '2026-12-30' }).where(eq(s.videos.id, v2.id));
    await deleteShootingDay(w.db, w.admin, '2026-12-30', { moveTo: '2026-11' }, NOW);
    expect((await w.db.select().from(s.videos).where(eq(s.videos.id, v2.id)))[0].cycleId).toBe('2026-11');
  });

  it('picks the next shooting day by date, with two days in one month', async () => {
    await addShootingDay(w.db, w.admin, { shootDate: '2027-02-20' }, NOW);
    await addShootingDay(w.db, w.admin, { shootDate: '2027-02-05' }, NOW);
    const shell = await loadShellData(w.db, w.admin, new Date('2027-02-10T10:00:00+01:00'));
    expect(shell.defaultCycleId).toBe('2027-02-20');
    expect(shell.cycleIds.indexOf('2027-02-05')).toBeLessThan(shell.cycleIds.indexOf('2027-02-20'));
    const before = await loadShellData(w.db, w.admin, new Date('2027-02-01T10:00:00+01:00'));
    expect(before.defaultCycleId).toBe('2027-02-05');
  });
});
