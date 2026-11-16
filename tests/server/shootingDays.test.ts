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

  it('deletes only days without scripts', async () => {
    await addShootingDay(w.db, w.admin, { shootDate: '2026-12-24' }, NOW);
    await expectDomainError(deleteShootingDay(w.db, w.admin, '2026-11', NOW), 'VALIDATION', 'Na tento den jsou přiřazené scénáře (8). Nejdřív je přesuň.');
    await deleteShootingDay(w.db, w.admin, '2026-12-24', NOW);
    expect(await row('2026-12-24')).toBeUndefined();
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
