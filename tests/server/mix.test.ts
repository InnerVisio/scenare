import { beforeAll, describe, expect, it } from 'vitest';
import * as s from '@/db/schema';
import { getCycleMix } from '@/server/mix';
import { loadEditorOptions } from '@/server/editorOptions';
import { getDashboard, listVideos } from '@/server/queries';
import { loadReviewPage } from '@/server/review';
import { createVideo } from '@/server/videos';
import { mixHints } from '../../src/app/(app)/_components/editor/mixHints';
import { NOW, setupWorld, type World } from './helpers';

let w: World;
beforeAll(async () => {
  w = await setupWorld();
}, 60_000);

describe('getCycleMix', () => {
  it('counts the demo cycle against the Excel plan (16 → 5/6/3/2 and 5/11)', async () => {
    const mix = await getCycleMix(w.db, '2026-11');
    expect(mix.plan).toBe(16);
    expect(mix.categories.rows.map((r) => r.plan)).toEqual([5, 6, 3, 2]);
    expect(mix.treatments.rows.map((r) => r.plan)).toEqual([5, 11]);
    const videos = await w.db.select().from(s.videos);
    const counted = videos.filter((v) => v.cycleId === '2026-11' && !['postponed', 'cancelled'].includes(v.approvalStatus));
    expect(mix.categories.total.proposed + mix.categories.unassigned).toBe(counted.length);
    expect(mix.unassigned).toBe(0); // the demo scripts are complete
    expect(mix.characters.map((c) => c.profileKey)).toEqual(['honza', 'radek']);
  });

  it('is the same as the dashboard and the editor compute from the rows they already loaded', async () => {
    const mix = await getCycleMix(w.db, '2026-11');
    const dashboard = await getDashboard(w.db, w.admin, NOW);
    expect(dashboard.cycle?.id).toBe('2026-11');
    expect(dashboard.mix).toEqual(mix);

    const options = await loadEditorOptions(w.db);
    const hints = mixHints(options, { cycleId: '2026-11', categoryKey: 'trendy', treatmentKey: 'odborne', profileKey: 'radek', characterKey: 'pracovni' });
    const trendy = mix.categories.rows.find((r) => r.key === 'trendy')!;
    expect(hints.category).toBe(`Trendy: ${trendy.approved} / ${trendy.plan} schváleno, chybí ${trendy.missing}`);
    expect(hints.character).toMatch(/^Radek: pracovní \d+ % · cíl 30 %$/);
    expect(hints.categoryMissing.trendy ?? 0).toBe(trendy.missing);
  });
});

describe('unassigned scripts', () => {
  it('shows up in the mix and in the „Nezařazené“ list filter', async () => {
    const { code } = await createVideo(w.db, w.admin, { title: 'Bez zařazení', cycleId: '2026-11' }, NOW);
    expect((await getCycleMix(w.db, '2026-11')).unassigned).toBe(1);
    const items = await listVideos(w.db, w.admin, { cycleId: '2026-11', unassigned: true });
    expect(items.map((i) => i.code)).toEqual([code]);
  });
});

describe('review chip', () => {
  it('is the position among the category scripts of the cycle by code', async () => {
    const rows = await w.db.select().from(s.videos);
    const peers = rows
      .filter((v) => v.cycleId === '2026-11' && v.categoryKey === 'nabor' && v.approvalStatus !== 'cancelled')
      .sort((a, b) => a.code.localeCompare(b.code));
    expect(peers.length).toBeGreaterThan(1);
    const second = peers[1];
    const { data } = await loadReviewPage(w.db, w.honza, second.code, { cycleParam: undefined }, NOW);
    expect(data.categoryChip).toEqual({ label: 'Nábor', position: 2, total: peers.length });
  });
});
