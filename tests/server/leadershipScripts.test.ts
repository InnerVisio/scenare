import { beforeAll, describe, expect, it } from 'vitest';
import { getLeadershipScripts } from '@/server/leadershipScripts';
import { setupWorld, type World } from './helpers';

const NOW = new Date('2026-11-15T10:00:00+01:00');
let w: World;
beforeAll(async () => {
  w = await setupWorld();
});

describe('getLeadershipScripts', () => {
  it('next mode: the upcoming cycle grouped by plain status', async () => {
    const r = await getLeadershipScripts(w.db, w.radek, { all: false }, NOW);
    expect(r.sections).toHaveLength(1);
    const [c] = r.sections;
    expect(c.id).toBe('2026-11');
    expect(c.kind).toBe('next');
    expect(c.daysToShoot).toBe(5);
    expect(c.label).toMatch(/^Natáčení 20\. 11\./);
    expect(c.groups.me.every((i) => i.status.label === 'Čeká na tebe')).toBe(true);
    expect(c.groups.me.length).toBeGreaterThan(0);
    expect(c.groups.muted.every((i) => ['Odloženo', 'Zrušeno'].includes(i.status.label))).toBe(true);
    expect(c.totalCount).toBe(Object.values(c.groups).flat().length - c.groups.muted.length);
    expect(c.approvedCount).toBe(c.groups.approved.length);
    expect(r.unscheduledCount).toBe(0);
  });

  it('all mode: every cycle plus the scripts without a cycle', async () => {
    const r = await getLeadershipScripts(w.db, w.radek, { all: true }, NOW);
    expect(r.sections[0].kind).toBe('next');
    const total = r.sections.reduce((n, sec) => n + Object.values(sec.groups).flat().length, 0) + r.unscheduledCount;
    expect(total).toBeGreaterThan(0);
  });
});
