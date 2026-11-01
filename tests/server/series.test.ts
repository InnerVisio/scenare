import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as s from '@/db/schema';
import { newId } from '@/domain/ids';
import { closeSeries, createEpisode, createSeries, loadSeriesDetail, loadSeriesList, updateSeries } from '@/server/series';
import { expectDomainError, NOW, setupWorld, type World } from './helpers';

let w: World;
beforeAll(async () => {
  w = await setupWorld();
}, 60_000);

const getSeries = async (id: string) => (await w.db.select().from(s.series).where(eq(s.series.id, id)))[0];

describe('demo series S01', () => {
  it('has the two demo scripts as episodes 1 and 2 and cannot be closed yet', async () => {
    const detail = await loadSeriesDetail(w.db, 'S01');
    expect(detail.series).toMatchObject({ code: 'S01', name: 'Mýty o hypotékách', plannedEpisodes: 3 });
    expect(detail.episodes.map((e) => [e.episodeNo, e.code])).toEqual([[1, 'V028'], [2, 'V032']]);
    expect(detail.metrics.withScript).toBe(2);
    expect(detail.metrics.canClose).toBe(false);
    expect(detail.metrics.reasons[0]).toBe('Publikováno 0 z 3.');
    const list = await loadSeriesList(w.db);
    expect(list.map((x) => x.code)).toContain('S01');
  });
});

describe('createSeries', () => {
  it('allocates the next code and logs it; only an admin may create', async () => {
    const { id, code } = await createSeries(w.db, w.admin, { name: '  Nová  ', plannedEpisodes: 2 }, NOW);
    expect(code).toBe('S02');
    expect(await getSeries(id)).toMatchObject({ name: 'Nová', plannedEpisodes: 2, originalPlannedEpisodes: 2, status: 'active', ownerId: w.admin.id });
    const log = await w.db.select().from(s.activityLog).where(eq(s.activityLog.entityId, id));
    expect(log.map((l) => l.action)).toEqual(['series.created']);
    await expectDomainError(createSeries(w.db, w.honza, { name: 'X' }, NOW), 'FORBIDDEN');
    await expectDomainError(createSeries(w.db, w.admin, { name: ' ' }, NOW), 'VALIDATION');
  });
});

describe('updateSeries', () => {
  it('requires a reason to change the planned episodes and keeps the original plan', async () => {
    const { id } = await createSeries(w.db, w.admin, { name: 'Rozsah', plannedEpisodes: 3 }, NOW);
    await expectDomainError(updateSeries(w.db, w.admin, id, { plannedEpisodes: 5 }, NOW), 'VALIDATION', 'Zadej důvod změny rozsahu.');
    await updateSeries(w.db, w.admin, id, { plannedEpisodes: 5, scopeChangeReason: 'Přidány dva díly' }, NOW);
    expect(await getSeries(id)).toMatchObject({ plannedEpisodes: 5, originalPlannedEpisodes: 3, scopeChangeReason: 'Přidány dva díly' });
    await updateSeries(w.db, w.admin, id, { name: 'Přejmenováno', goal: 'Cíl', status: 'paused' }, NOW);
    expect(await getSeries(id)).toMatchObject({ name: 'Přejmenováno', goal: 'Cíl', status: 'paused', plannedEpisodes: 5 });
  });

  it('accepts only leadership as guarantor, refuses closing through the form and non-admins', async () => {
    const { id } = await createSeries(w.db, w.admin, { name: 'Garant' }, NOW);
    await updateSeries(w.db, w.admin, id, { guarantorId: w.honza.id }, NOW);
    expect((await getSeries(id)).guarantorId).toBe(w.honza.id);
    await expectDomainError(updateSeries(w.db, w.admin, id, { guarantorId: w.admin.id }, NOW), 'VALIDATION');
    await expectDomainError(updateSeries(w.db, w.admin, id, { status: 'closed' }, NOW), 'VALIDATION');
    await expectDomainError(updateSeries(w.db, w.radek, id, { name: 'Hack' }, NOW), 'FORBIDDEN');
  });
});

describe('createEpisode', () => {
  it('creates a draft with the next episode number in the series category', async () => {
    const detail = await loadSeriesDetail(w.db, 'S01');
    const { code } = await createEpisode(w.db, w.admin, detail.series.id, NOW);
    const [video] = await w.db.select().from(s.videos).where(eq(s.videos.code, code));
    expect(video).toMatchObject({ seriesId: detail.series.id, episodeNo: 3, categoryKey: 'produkt', approvalStatus: 'draft' });
    expect(video.title).toContain('Mýty o hypotékách');
    await expectDomainError(createEpisode(w.db, w.honza, detail.series.id, NOW), 'FORBIDDEN');
  });
});

describe('closeSeries', () => {
  it('refuses with the reasons and closes once everything is published with a URL', async () => {
    const { id, code } = await createSeries(w.db, w.admin, { name: 'Zavřít', plannedEpisodes: 1 }, NOW);
    await expectDomainError(closeSeries(w.db, w.admin, id, NOW), 'VALIDATION', 'Publikováno 0 z 1.');

    const { id: videoId } = await w.db.transaction(async (tx) => {
      const [v] = await tx.select({ id: s.videos.id }).from(s.videos).where(eq(s.videos.code, 'V036'));
      await tx.update(s.videos).set({ seriesId: id, episodeNo: 1 }).where(eq(s.videos.id, v.id));
      return v;
    });
    await w.db.insert(s.publications).values({ id: newId(), videoId, profileKey: 'radek', publishedAt: NOW, url: '' });
    await expectDomainError(closeSeries(w.db, w.admin, id, NOW), 'VALIDATION', 'Publikace bez odkazu: 1.');
    await w.db.update(s.publications).set({ url: 'https://example.com/v' }).where(eq(s.publications.videoId, videoId));

    await expectDomainError(closeSeries(w.db, w.honza, id, NOW), 'FORBIDDEN');
    await closeSeries(w.db, w.admin, id, NOW);
    expect(await getSeries(id)).toMatchObject({ status: 'closed', closedBy: w.admin.id, closedAt: NOW });
    const detail = await loadSeriesDetail(w.db, code);
    expect(detail.metrics.checks).toEqual([]);
    const log = await w.db.select().from(s.activityLog).where(eq(s.activityLog.entityId, id));
    expect(log.map((l) => l.action)).toContain('series.closed');
  });
});
