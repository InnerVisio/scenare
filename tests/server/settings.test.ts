import { asc } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as s from '@/db/schema';
import {
  addNextCycle,
  getSettings,
  listLookups,
  listUsers,
  upsertLookup,
  upsertLookups,
  upsertUser,
  updateSettings,
} from '@/server/settings';
import { expectDomainError, NOW, setupWorld, type World } from './helpers';

let w: World;
beforeAll(async () => {
  w = await setupWorld();
});

describe('settings permissions', () => {
  it('rejects non-admins on every write', async () => {
    await expectDomainError(updateSettings(w.db, w.honza, { monthlyTarget: 20 }, NOW), 'FORBIDDEN');
    await expectDomainError(addNextCycle(w.db, w.radek, NOW), 'FORBIDDEN');
    await expectDomainError(
      upsertLookup(w.db, w.honza, { kind: 'location', key: 'x', label: 'X', sortOrder: 1, archived: false, data: {} }, NOW),
      'FORBIDDEN',
    );
    await expectDomainError(
      upsertUser(w.db, w.honza, { name: 'N', email: 'n@gta.local', role: 'marketer', initials: 'N' }, NOW),
      'FORBIDDEN',
    );
  });
});

describe('settings', () => {
  it('updates parameters and validates them', async () => {
    await updateSettings(w.db, w.admin, { monthlyTarget: 18, approvalPolicy: 'any_leadership' }, NOW);
    expect(await getSettings(w.db)).toMatchObject({ monthlyTarget: 18, approvalPolicy: 'any_leadership' });
    await expectDomainError(updateSettings(w.db, w.admin, { monthlyTarget: 0 }, NOW), 'VALIDATION');
    await updateSettings(w.db, w.admin, { monthlyTarget: 16, approvalPolicy: 'all_leadership' }, NOW);
  });
});

describe('lookups', () => {
  it('requires category shares to sum to 100 %', async () => {
    const categories = await listLookups(w.db, 'category');
    const bad = categories.map((c, i) => ({ ...c, data: { ...c.data, share: i === 0 ? 0.5 : c.data.share } }));
    await expectDomainError(upsertLookups(w.db, w.admin, bad, NOW), 'VALIDATION', 'Součet podílů musí být 100 %.');

    const moved = categories.map((c, i) => ({ ...c, data: { ...c.data, share: i === 0 ? 0.4 : i === 1 ? 0.3 : c.data.share } }));
    await upsertLookups(w.db, w.admin, moved, NOW);
    const after = await listLookups(w.db, 'category');
    expect(after.reduce((sum, c) => sum + Number(c.data.share), 0)).toBeCloseTo(1, 5);
  });

  it('creates and edits a plain lookup', async () => {
    await upsertLookup(w.db, w.admin, { kind: 'location', key: 'nova', label: 'Nová', sortOrder: 990, archived: false, data: { note: 'x' } }, NOW);
    await upsertLookup(w.db, w.admin, { kind: 'location', key: 'nova', label: 'Nová místnost', sortOrder: 990, archived: true, data: { note: 'y' } }, NOW);
    const item = (await listLookups(w.db, 'location')).find((l) => l.key === 'nova');
    expect(item).toMatchObject({ label: 'Nová místnost', archived: true, data: { note: 'y' } });
  });
});

describe('users', () => {
  it('creates and edits a user', async () => {
    await upsertUser(w.db, w.admin, { name: 'Nový', email: 'novy@gta.local', role: 'marketer', initials: 'N' }, NOW);
    const created = (await listUsers(w.db)).find((u) => u.email === 'novy@gta.local')!;
    await upsertUser(w.db, w.admin, { id: created.id, name: 'Nový Marketér', email: 'novy@gta.local', role: 'production', initials: 'NM' }, NOW);
    expect((await listUsers(w.db)).find((u) => u.id === created.id)).toMatchObject({ name: 'Nový Marketér', role: 'production', initials: 'NM' });
  });
});

describe('addNextCycle', () => {
  it('adds the month after the latest cycle, rolling over the year', async () => {
    await updateSettings(w.db, w.admin, { monthlyTarget: 14 }, NOW);
    expect(await addNextCycle(w.db, w.admin, NOW)).toEqual({ id: '2026-12' });
    expect(await addNextCycle(w.db, w.admin, NOW)).toEqual({ id: '2027-01' });
    const cycles = await w.db.select().from(s.shootingCycles).orderBy(asc(s.shootingCycles.id));
    expect(cycles.map((c) => c.id)).toEqual(['2026-11', '2026-12', '2027-01']);
    expect(cycles[2]).toMatchObject({ plannedVideos: 14, coversMonths: ['2027-01'], shootDate: null });
  });
});
