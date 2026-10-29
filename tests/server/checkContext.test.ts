import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '@/db/client';
import * as s from '@/db/schema';
import { DEFAULT_RULES } from '@/domain/checks/rules';
import { buildCheckContext, loadRules } from '@/server/checkContext';
import { setupWorld, type World } from './helpers';

describe('buildCheckContext', () => {
  let w: World;
  beforeAll(async () => {
    w = await setupWorld();
  }, 60_000);

  it('maps video, format lookup, profile hashtags and number checks', async () => {
    const [video] = await w.db.select().from(s.videos).where(eq(s.videos.code, 'V026'));
    await w.db.insert(s.numberChecks).values([
      { id: 'n1', videoId: video.id, fieldId: 'caption', quotedText: '5', status: 'pending' },
      { id: 'n2', videoId: video.id, fieldId: 'caption', quotedText: '6', status: 'confirmed' },
    ]);
    const [version] = await w.db.select().from(s.scriptVersions).where(eq(s.scriptVersions.id, 'sample-v026-v2'));
    const ctx = await buildCheckContext(w.db, video, version);
    expect(ctx.body).toEqual(version.body);
    expect(ctx.goalMetric).toBe('shares');
    expect(ctx.isSeriesEpisode).toBe(false);
    expect(ctx.formatStatus).toBe('verified'); // kancelarsky-sketch
    expect(ctx.isTrialReel).toBe(false);
    expect(ctx.numberChecks.map((n) => n.status).sort()).toEqual(['confirmed', 'pending']);
    expect(ctx.personHashtags).toEqual({ Honza: '#honzagizicky', Radek: '#radekteichmann' });
    expect(ctx.manualChecks).toEqual({});
  });

  it('reads manual checks of this version only and flags series episodes', async () => {
    const [video] = await w.db.select().from(s.videos).where(eq(s.videos.code, 'V033'));
    const withManual = { ...video, seriesId: 'ser1', manualChecks: { 'ver-1': { GDPR: true }, 'ver-2': { PILLAR: true } } };
    const ctx = await buildCheckContext(w.db, withManual, { id: 'ver-1', body: video.draft! });
    expect(ctx.manualChecks).toEqual({ GDPR: true });
    expect(ctx.isSeriesEpisode).toBe(true);
    expect(ctx.formatStatus).toBe('untested'); // hot-take
  });

  it('formatStatus is null without a format', async () => {
    const [video] = await w.db.select().from(s.videos).where(eq(s.videos.code, 'V033'));
    const ctx = await buildCheckContext(w.db, { ...video, formatKey: null }, { id: 'x', body: video.draft! });
    expect(ctx.formatStatus).toBeNull();
  });
});

describe('loadRules', () => {
  it('maps non-archived check_rule lookups', async () => {
    const w = await setupWorld();
    const rules = await loadRules(w.db);
    expect(rules).toHaveLength(13);
    const length = rules.find((r) => r.code === 'LENGTH')!;
    expect(length).toMatchObject({ severity: 'reject', mode: 'auto', enabled: true });
    expect(length.params).toMatchObject({ min: 12, max: 25 });

    await w.db.update(s.lookupItems).set({ archived: true }).where(eq(s.lookupItems.key, 'CTA'));
    expect((await loadRules(w.db)).some((r) => r.code === 'CTA')).toBe(false);
  }, 60_000);

  it('falls back to DEFAULT_RULES when no rules are configured', async () => {
    const db = await createTestDb();
    expect(await loadRules(db)).toEqual(DEFAULT_RULES);
  }, 60_000);
});
