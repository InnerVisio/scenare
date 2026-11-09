import { describe, expect, it } from 'vitest';
import {
  buildCycleStatus,
  buildHistory,
  buildMonthCharacters,
  buildScopedMix,
  historyStart,
  monthRange,
  type OverviewVideo,
} from '@/domain/metrics/overview';

const TODAY = '2026-10-26'; // `now` of the Excel cached values (2026-10-26)

const categories = [
  { key: 'nabor', label: 'Nábor, vedení lidí a práce s týmem', share: 0.3 },
  { key: 'osobni-brand', label: 'Osobní brand & Lifestyle', share: 0.4 },
  { key: 'trendy', label: 'Trendy a reakce na trh', share: 0.2 },
  { key: 'produkt', label: 'Produktové a poradenské tipy', share: 0.1 },
];
const treatments = [
  { key: 'odborne', label: 'Odborně hodnotné', share: 0.3 },
  { key: 'instagramove', label: 'Instagramové', share: 0.7 },
];

function v(p: Partial<OverviewVideo>): OverviewVideo {
  return {
    cycleId: null, plannedMonth: null, categoryKey: null, treatmentKey: null, profileKey: null, characterKey: null,
    approvalStatus: 'draft', productionStatus: 'waiting', scriptDueDate: null, approvalDeadline: null, publishedMonth: null, openComments: 0,
    ...p,
  };
}
const c11 = { cycleId: '2026-11', plannedMonth: '2026-11', approvalDeadline: '2026-11-13', scriptDueDate: '2026-11-03' };

// V001–V010 of docs/xlsx-analysis.md §3.4 (+ comments: V003 and V008 have one open comment each, as in the cached Section 4 row 40 = 2).
const V = [
  v({ cycleId: '2026-10', plannedMonth: '2026-10', categoryKey: 'nabor', treatmentKey: 'odborne', profileKey: 'gta', characterKey: 'nevztahuje', approvalStatus: 'approved', productionStatus: 'published', scriptDueDate: '2026-10-05', approvalDeadline: '2026-10-09', publishedMonth: '2026-10' }),
  v({ cycleId: '2026-10', plannedMonth: '2026-10', categoryKey: 'osobni-brand', treatmentKey: 'instagramove', profileKey: 'honza', characterKey: 'osobni', approvalStatus: 'approved', productionStatus: 'published', scriptDueDate: '2026-10-05', approvalDeadline: '2026-10-09', publishedMonth: '2026-10' }),
  v({ ...c11, categoryKey: 'trendy', treatmentKey: 'odborne', profileKey: 'radek', characterKey: 'pracovni', approvalStatus: 'in_review', openComments: 1 }),
  v({ ...c11, categoryKey: 'produkt', treatmentKey: 'odborne', profileKey: 'radek', characterKey: 'pracovni', approvalStatus: 'approved' }),
  v({ ...c11, categoryKey: 'produkt', treatmentKey: 'instagramove', profileKey: 'radek', characterKey: 'pracovni', approvalStatus: 'returned' }),
  v({ cycleId: '2026-12', plannedMonth: '2026-12', approvalDeadline: '2026-12-11', scriptDueDate: '2026-11-25', categoryKey: 'produkt', treatmentKey: 'odborne', profileKey: 'radek', characterKey: 'pracovni', approvalStatus: 'draft', productionStatus: 'waiting' }),
  v({ ...c11, scriptDueDate: '2026-10-20', categoryKey: 'osobni-brand', treatmentKey: 'instagramove', profileKey: 'radek', characterKey: 'osobni', approvalStatus: 'returned' }),
  v({ ...c11, categoryKey: 'nabor', treatmentKey: 'instagramove', profileKey: 'gta', characterKey: 'nevztahuje', approvalStatus: 'final_review', openComments: 1 }),
  v({ ...c11, categoryKey: 'osobni-brand', treatmentKey: 'instagramove', profileKey: 'honza', characterKey: 'osobni', approvalStatus: 'approved' }),
  v({ ...c11, categoryKey: 'nabor', treatmentKey: 'instagramove', profileKey: 'honza', characterKey: 'pracovni', approvalStatus: 'approved', productionStatus: 'editing' }),
];


describe('overview – Excel cached values (§7.10, month 2026-11, cycle 2026-11, today 2026-10-26)', () => {
  it('section 1: thematic mix of the month', () => {
    const { rows, total } = buildScopedMix(V, categories, 16, 'category', { kind: 'month', month: '2026-11' });
    expect(rows.map((r) => [r.plan, r.proposed, r.approved, r.missing, r.shot, r.published, r.fulfilment, r.status])).toEqual([
      [5, 2, 1, 4, 1, 0, 0, 'missing'],
      [6, 2, 1, 5, 0, 0, 0, 'missing'],
      [3, 1, 0, 3, 0, 0, 0, 'missing'],
      [2, 2, 1, 1, 0, 0, 0, 'pending'],
    ]);
    expect([total.plan, total.proposed, total.approved, total.missing, total.shot, total.published, total.status]).toEqual([16, 7, 3, 13, 1, 0, 'missing']);
  });

  it('section 2: odborně hodnotné vs. instagramové', () => {
    const { rows, total } = buildScopedMix(V, treatments, 16, 'treatment', { kind: 'month', month: '2026-11' });
    expect(rows.map((r) => [r.plan, r.proposed, r.approved, r.missing, r.shot, r.published, r.status])).toEqual([
      [5, 2, 1, 4, 0, 0, 'missing'],
      [11, 5, 2, 9, 1, 0, 'missing'],
    ]);
    expect([total.plan, total.proposed, total.approved, total.missing, total.shot]).toEqual([16, 7, 3, 13, 1]);
  });

  it('section 3: personal vs. work, tolerance 10 p. b.', () => {
    const personal = [{ key: 'honza', label: 'Honza' }, { key: 'radek', label: 'Radek' }];
    const chars = [{ key: 'osobni', label: 'Osobní', share: 0.7 }, { key: 'pracovni', label: 'Pracovní', share: 0.3 }];
    const rows = buildMonthCharacters(V, '2026-11', personal, chars, 10);
    expect(rows.map((r) => [r.profileKey, r.characterKey, r.scripts, r.scriptShare, r.prepStatus, r.published, r.publishedShare, r.publicationStatus])).toEqual([
      ['honza', 'osobni', 1, 0.5, 'out', 0, null, 'none'],
      ['honza', 'pracovni', 1, 0.5, 'out', 0, null, 'none'],
      ['radek', 'osobni', 1, 0.25, 'out', 0, null, 'none'],
      ['radek', 'pracovni', 3, 0.75, 'out', 0, null, 'none'],
    ]);
  });

  it('section 4: approval state of the cycle vs. all cycles', () => {
    const s = buildCycleStatus(V, '2026-11', 16, TODAY);
    expect(s.plan).toBe(16);
    expect(s.missingApproved).toBe(13);
    const row = (c: typeof s.selected) => [c.total, c.awaitingLeadership, c.awaitingMarketers, c.approved, c.approvedWaitingForShoot, c.overdueScripts, c.unapprovedAfterDeadline, c.openComments, c.shot, c.postponedOrCancelled];
    expect(row(s.selected)).toEqual([7, 2, 2, 3, 2, 1, 0, 2, 1, 0]);
    expect(row(s.all)).toEqual([10, 2, 3, 5, 2, 1, 0, 2, 3, 0]);
    // after the approval deadline (2026-11-13) the unapproved scripts of the cycle count
    expect(buildCycleStatus(V, '2026-11', 16, '2026-11-14').selected.unapprovedAfterDeadline).toBe(4);
  });

  it('section 5: mix of the shooting cycle (plan 16, no publication)', () => {
    const { rows, total } = buildScopedMix(V, categories, 16, 'category', { kind: 'cycle', cycleId: '2026-11' });
    expect(rows.map((r) => [r.plan, r.proposed, r.approved, r.missing, r.shot, r.status])).toEqual([
      [5, 2, 1, 4, 1, 'missing'],
      [6, 2, 1, 5, 0, 'missing'],
      [3, 1, 0, 3, 0, 'missing'],
      [2, 2, 1, 1, 0, 'pending'],
    ]);
    expect([total.plan, total.proposed, total.approved, total.missing, total.shot, total.status]).toEqual([16, 7, 3, 13, 1, 'missing']);
  });

  it('section 7: history by month', () => {
    const start = historyStart(V, '2026-11');
    expect(start).toBe('2026-10');
    const months = monthRange(start, 24);
    expect(months[0]).toBe('2026-10');
    expect(months[23]).toBe('2028-09');
    const rows = buildHistory(V, months, 16, categories, treatments);
    const r = (i: number) => [rows[i].month, rows[i].plan, rows[i].scripts, rows[i].approved, rows[i].published, rows[i].fulfilment];
    expect(r(0)).toEqual(['2026-10', 16, 2, 2, 2, 0.125]);
    expect(Object.values(rows[0].byCategory)).toEqual([1, 1, 0, 0]);
    expect(Object.values(rows[0].byTreatment)).toEqual([1, 1]);
    expect(r(1)).toEqual(['2026-11', 16, 7, 3, 0, 0]);
    expect(r(2)).toEqual(['2026-12', 16, 1, 0, 0, 0]);
    expect(rows.slice(3).every((x) => x.scripts === 0 && x.published === 0)).toBe(true);
  });
});

describe('overview – edge cases', () => {
  it('excludes postponed and cancelled from proposed, counts published by the actual month, status published wins', () => {
    const rows = [
      v({ plannedMonth: '2026-11', categoryKey: 'produkt', approvalStatus: 'postponed' }),
      v({ plannedMonth: '2026-11', categoryKey: 'produkt', approvalStatus: 'approved', publishedMonth: '2026-12' }),
      v({ plannedMonth: '2026-10', categoryKey: 'produkt', approvalStatus: 'approved', publishedMonth: '2026-11' }),
    ];
    const { rows: mix } = buildScopedMix(rows, categories, 10, 'category', { kind: 'month', month: '2026-11' });
    const produkt = mix[3];
    expect([produkt.proposed, produkt.approved, produkt.published]).toEqual([1, 1, 1]);
    expect(buildScopedMix(rows, categories, 0, 'category', { kind: 'month', month: '2026-11' }).total.status).toBe('none');
    const done = buildScopedMix([v({ plannedMonth: '2026-11', categoryKey: 'osobni-brand', publishedMonth: '2026-11', approvalStatus: 'approved' })], categories, 1, 'category', { kind: 'month', month: '2026-11' });
    expect(done.rows[1].plan).toBe(1);
    expect(done.rows[1].status).toBe('published');
  });
});
