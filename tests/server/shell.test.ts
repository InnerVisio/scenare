import { beforeAll, describe, expect, it } from 'vitest';
import { loadShellData } from '@/server/shell';
import { NOW, setupWorld, type World } from './helpers';

let w: World;
beforeAll(async () => {
  w = await setupWorld();
});

describe('loadShellData', () => {
  it('counts the leadership review queue and picks the upcoming cycle', async () => {
    const honza = await loadShellData(w.db, w.honza, NOW);
    expect(honza.user).toMatchObject({ name: w.honza.name, role: 'leadership' });
    expect(honza.queueCount).toBeGreaterThan(0);
    expect(honza.currentMonth).toBe('2026-10');
    expect(honza.defaultCycleId).toBe(honza.cycleIds[0]);
  });

  it('shows no queue badge to the admin', async () => {
    const admin = await loadShellData(w.db, w.admin, NOW);
    expect(admin.queueCount).toBe(0);
  });
});
