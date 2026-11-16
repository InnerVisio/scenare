import { beforeAll, describe, expect, it } from 'vitest';
import { getLeadershipHome, getLeadershipScripts } from '@/server/leadershipScripts';
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

describe('getLeadershipHome', () => {
  it('groups the next shooting day into category boxes whose counts match the scripts', async () => {
    const home = await getLeadershipHome(w.db, w.radek, { all: false }, NOW);
    const scripts = await getLeadershipScripts(w.db, w.radek, { all: false }, NOW);
    expect(home.shootDate).toBe('2026-11-20');
    expect(home.boxes.length).toBeGreaterThanOrEqual(4);
    const counted = scripts.sections[0].totalCount;
    expect(home.boxes.reduce((n, b) => n + b.total, 0)).toBe(counted);
    expect(home.boxes.reduce((n, b) => n + b.done, 0)).toBe(scripts.sections[0].approvedCount);
    for (const b of home.boxes) {
      expect(b.scripts).toHaveLength(b.total);
      expect(b.toReview).toBe(b.scripts.filter((s) => s.dot.color === 'yellow').length);
      const ranks = b.scripts.map((s) => s.dot.rank);
      expect(ranks).toEqual([...ranks].sort((a, c) => a - c));
    }
  });
});
