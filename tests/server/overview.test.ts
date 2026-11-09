import { beforeAll, describe, expect, it } from 'vitest';
import { getOverview } from '@/server/overview';
import { NOW, setupWorld, type World } from './helpers';

let w: World;
beforeAll(async () => {
  w = await setupWorld();
});

describe('getOverview', () => {
  it('builds all sections from the seeded demo data', async () => {
    const o = await getOverview(w.db, { month: '2026-11', cycleId: '2026-11' }, NOW);
    expect(o.categories.rows).toHaveLength(4);
    expect(o.categories.total.plan).toBe(16);
    expect(o.treatments.total.plan).toBe(16);
    expect(o.characters.length).toBeGreaterThan(0);
    expect(o.cycleStatus?.selected.total).toBeGreaterThan(0);
    expect(o.cycleCategories?.total.plan).toBe(o.cycle?.plan);
    expect(o.history).toHaveLength(24);
    expect(o.history.some((h) => h.month === '2026-11')).toBe(true);
  });

  it('falls back to the next shoot when no cycle is given', async () => {
    const o = await getOverview(w.db, { month: '2026-11', cycleId: null }, NOW);
    expect(o.cycleId).toBe('2026-11');
    expect(o.cycleStatus).not.toBeNull();
  });
});
