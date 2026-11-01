import { describe, expect, it } from 'vitest';
import { computeSeriesMetrics, type EpisodeFacts, type SeriesFacts } from '@/domain/series/metrics';

const series = (over: Partial<SeriesFacts> = {}): SeriesFacts => ({
  plannedEpisodes: 3,
  originalPlannedEpisodes: 3,
  scopeChangeReason: '',
  status: 'active',
  closedBy: null,
  closedAt: null,
  ...over,
});
const ep = (over: Partial<EpisodeFacts> = {}): EpisodeFacts => ({
  approvalStatus: 'approved',
  productionStatus: 'published',
  openRootComments: 0,
  publications: 1,
  publicationsWithoutUrl: 0,
  ...over,
});

describe('computeSeriesMetrics', () => {
  it('counts episodes with script, approved, shot and published (cancelled excluded)', () => {
    const m = computeSeriesMetrics(series({ plannedEpisodes: 4 }), [
      ep(),
      ep({ approvalStatus: 'in_review', productionStatus: 'editing', publications: 0 }),
      ep({ approvalStatus: 'draft', productionStatus: 'waiting', publications: 0 }),
      ep({ approvalStatus: 'cancelled', productionStatus: 'shot', publications: 0 }),
    ]);
    expect(m.withScript).toBe(3);
    expect(m.approved).toBe(1);
    expect(m.shot).toBe(2);
    expect(m.published).toBe(1);
    expect(m.fulfilmentPct).toBe(25);
    expect(m.remaining).toBe(3);
  });

  it('counts a video once however many publications it has', () => {
    const m = computeSeriesMetrics(series({ plannedEpisodes: 2 }), [ep({ publications: 3 }), ep({ publications: 0 })]);
    expect(m.published).toBe(1);
  });

  it('remaining never goes below zero', () => {
    const m = computeSeriesMetrics(series({ plannedEpisodes: 1 }), [ep(), ep()]);
    expect(m.remaining).toBe(0);
    expect(m.fulfilmentPct).toBe(200);
  });

  it('may be closed only with the plan published, no open comments and no publication without a URL', () => {
    expect(computeSeriesMetrics(series({ plannedEpisodes: 1 }), [ep()])).toMatchObject({ canClose: true, reasons: [] });

    const m = computeSeriesMetrics(series({ plannedEpisodes: 8 }), [
      ep(),
      ep({ openRootComments: 1 }),
      ep({ openRootComments: 1, publicationsWithoutUrl: 2 }),
    ]);
    expect(m.canClose).toBe(false);
    expect(m.openComments).toBe(2);
    expect(m.publicationsWithoutUrl).toBe(2);
    expect(m.reasons).toEqual(['Publikováno 3 z 8.', 'Otevřené připomínky: 2.', 'Publikace bez odkazu: 2.']);
    expect(m.reasons.slice(0, 2).join(' ')).toBe('Publikováno 3 z 8. Otevřené připomínky: 2.');
  });

  it('cannot be closed without a planned number of episodes', () => {
    const m = computeSeriesMetrics(series({ plannedEpisodes: null, originalPlannedEpisodes: null }), [ep()]);
    expect(m.canClose).toBe(false);
    expect(m.reasons).toEqual(['Není zadaný plán dílů.']);
  });

  it('reports the §8.2 checks', () => {
    const closedAt = new Date();
    expect(computeSeriesMetrics(series({ status: 'closed', plannedEpisodes: 1, originalPlannedEpisodes: 1 }), [ep()]).checks).toEqual([
      'Uzavřeno bez potvrzení, kdo a kdy.',
    ]);
    expect(computeSeriesMetrics(series({ status: 'closed', closedBy: 'u', closedAt, plannedEpisodes: 2, originalPlannedEpisodes: 2 }), [ep()]).checks).toEqual([
      'Uzavřeno bez splněných podmínek.',
    ]);
    expect(computeSeriesMetrics(series({ plannedEpisodes: 4, originalPlannedEpisodes: 3 }), []).checks).toEqual([
      'Rozsah změněn bez uvedeného důvodu.',
    ]);
    expect(computeSeriesMetrics(series({ plannedEpisodes: 1, originalPlannedEpisodes: 1 }), [ep(), ep({ publications: 0 })]).checks).toEqual([
      'Víc dílů (2) než plán (1).',
    ]);
    expect(computeSeriesMetrics(series({ plannedEpisodes: 4, originalPlannedEpisodes: 3, scopeChangeReason: 'Přidán díl' }), []).checks).toEqual([]);
  });
});
