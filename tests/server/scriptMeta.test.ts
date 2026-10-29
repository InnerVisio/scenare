import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as s from '@/db/schema';
import { getVideoDetail } from '@/server/queries';
import { buildScriptMeta } from '@/server/scriptMeta';
import { setupWorld, type World } from './helpers';

let w: World;
beforeAll(async () => {
  w = await setupWorld();
});

const metaOf = async (code: string) => {
  const [video] = await w.db.select().from(s.videos).where(eq(s.videos.code, code));
  return buildScriptMeta(w.db, await getVideoDetail(w.db, w.radek, video.id));
};

describe('buildScriptMeta', () => {
  it('maps lookups, goal, profile, locations and CTA for V031', async () => {
    const meta = await metaOf('V031');
    expect(meta).toMatchObject({
      code: 'V031',
      versionNo: 2,
      title: 'Klient s chybou: fixace hypotéky',
      isTrialReel: true,
      durationSec: 21,
      goalLabel: 'Sdílení',
      profileLabel: 'Radek · pracovní',
      ctaLabel: expect.stringMatching(/^[a-zěščřžýáíéúůň]/),
    });
    expect(meta.categoryTag.label).toBe('Produktové a poradenské tipy');
    expect(meta.categoryTag.colors.color).toMatch(/^#/);
    expect(meta.formatLabel).toContain('Klient s chybou');
    expect(meta.locationLabels).toEqual(['Klientské místnosti (přízemí)']);
    expect(meta.hookTypeLabels['problem-v-obraze']).toBe('Problém v obraze');
    expect(meta.seriesLabel).toBeUndefined();
  });

  it('adds the series label when the video belongs to a series', async () => {
    await w.db.insert(s.series).values({ id: 'ser-1', code: 'S03', name: 'Série tři' });
    await w.db.update(s.videos).set({ seriesId: 'ser-1', episodeNo: 3 }).where(eq(s.videos.code, 'V031'));
    expect((await metaOf('V031')).seriesLabel).toBe('Série S03 · díl 3');
  });

  it('labels the other goals', async () => {
    expect((await metaOf('V028')).goalLabel).toBe('Uložení');
    expect((await metaOf('V033')).goalLabel).toBe('Komentáře');
  });
});
