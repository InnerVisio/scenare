import { describe, expect, it } from 'vitest';
import { buildCharacterMix, buildMix, splitTarget, type MixItem, type MixVideo } from '@/domain/metrics/mix';

const categories: MixItem[] = [
  { key: 'trendy', label: 'Trendy', share: 0.3 },
  { key: 'produkt', label: 'Produkt', share: 0.4 },
  { key: 'nabor', label: 'Nábor', share: 0.2 },
  { key: 'lifestyle', label: 'Lifestyle', share: 0.1 },
];
const treatments: MixItem[] = [
  { key: 'odborne', label: 'Odborně hodnotné', share: 0.3 },
  { key: 'instagramove', label: 'Instagramové', share: 0.7 },
];
const characters = [
  { key: 'osobni', label: 'Osobní', share: 0.7 },
  { key: 'pracovni', label: 'Pracovní', share: 0.3 },
  { key: 'nevztahuje', label: 'Nevztahuje se', share: null },
];
const profiles = [
  { key: 'gta-partners', label: 'GTA Partners', personal: false },
  { key: 'honza', label: 'Honza', personal: true },
  { key: 'radek', label: 'Radek', personal: true },
];

const video = (over: Partial<MixVideo>): MixVideo => ({
  approvalStatus: 'draft',
  categoryKey: null,
  treatmentKey: null,
  profileKey: null,
  characterKey: null,
  ...over,
});

describe('splitTarget', () => {
  it('matches the Excel numbers', () => {
    expect(splitTarget(16, categories)).toEqual({ trendy: 5, produkt: 6, nabor: 3, lifestyle: 2 });
    expect(splitTarget(16, treatments)).toEqual({ odborne: 5, instagramove: 11 });
  });

  it('puts the rounding difference on the largest share (first on a tie)', () => {
    expect(splitTarget(10, [{ key: 'a', share: 0.25 }, { key: 'b', share: 0.25 }, { key: 'c', share: 0.5 }])).toEqual({ a: 3, b: 3, c: 4 });
    expect(splitTarget(5, [{ key: 'a', share: 0.5 }, { key: 'b', share: 0.5 }])).toEqual({ a: 2, b: 3 });
    expect(splitTarget(0, categories)).toEqual({ trendy: 0, produkt: 0, nabor: 0, lifestyle: 0 });
  });
});

describe('buildMix', () => {
  const videos = [
    video({ categoryKey: 'trendy', approvalStatus: 'approved' }),
    video({ categoryKey: 'trendy', approvalStatus: 'in_review' }),
    video({ categoryKey: 'trendy', approvalStatus: 'cancelled' }),
    video({ categoryKey: 'produkt', approvalStatus: 'postponed' }),
    video({ categoryKey: null, approvalStatus: 'draft' }),
  ];
  const mix = buildMix(videos, categories, 16, (v) => v.categoryKey);

  it('counts proposed without postponed/cancelled and reports the status', () => {
    const trendy = mix.rows[0];
    expect(trendy).toMatchObject({ plan: 5, proposed: 2, approved: 1, missing: 4, status: 'missing' });
    expect(mix.rows[1]).toMatchObject({ plan: 6, proposed: 0, approved: 0, missing: 6, status: 'missing' });
    expect(mix.total).toMatchObject({ plan: 16, proposed: 2, approved: 1, missing: 15 });
    expect(mix.unassigned).toBe(1);
  });

  it('pending when proposed reaches the plan, approved when approved does, none without a plan', () => {
    const pending = buildMix([video({ categoryKey: 'a' }), video({ categoryKey: 'a', approvalStatus: 'approved' })], [{ key: 'a', label: 'A', share: 1 }], 2, (v) => v.categoryKey);
    expect(pending.rows[0].status).toBe('pending');
    const done = buildMix([video({ categoryKey: 'a', approvalStatus: 'approved' })], [{ key: 'a', label: 'A', share: 1 }], 1, (v) => v.categoryKey);
    expect(done.rows[0]).toMatchObject({ status: 'approved', missing: 0 });
    expect(buildMix([] as MixVideo[], categories, 0, (v) => v.categoryKey).rows[0].status).toBe('none');
  });

  it('works for the treatment dimension', () => {
    const t = buildMix([video({ treatmentKey: 'odborne', approvalStatus: 'approved' })], treatments, 16, (v) => v.treatmentKey);
    expect(t.rows.map((r) => r.plan)).toEqual([5, 11]);
    expect(t.rows[0].approved).toBe(1);
  });
});

describe('buildCharacterMix', () => {
  it('Radek with 1 personal / 3 work scripts is out (25 % vs 70 %, tolerance 10)', () => {
    const own = [
      video({ profileKey: 'radek', characterKey: 'osobni' }),
      video({ profileKey: 'radek', characterKey: 'pracovni' }),
      video({ profileKey: 'radek', characterKey: 'pracovni', approvalStatus: 'approved' }),
      video({ profileKey: 'radek', characterKey: 'pracovni' }),
      video({ profileKey: 'radek', characterKey: 'pracovni', approvalStatus: 'cancelled' }),
    ];
    const rows = buildCharacterMix(own, profiles, characters, 10);
    expect(rows.map((r) => r.profileKey)).toEqual(['honza', 'radek']);
    const radek = rows[1];
    expect(radek.status).toBe('out');
    expect(radek.total).toBe(4);
    expect(radek.characters.map((c) => [c.key, c.count, c.share, c.target])).toEqual([
      ['osobni', 1, 0.25, 0.7],
      ['pracovni', 3, 0.75, 0.3],
    ]);
    expect(rows[0].status).toBe('none');
  });

  it('is ok within the tolerance', () => {
    const own = [
      ...Array.from({ length: 7 }, () => video({ profileKey: 'honza', characterKey: 'osobni' })),
      ...Array.from({ length: 3 }, () => video({ profileKey: 'honza', characterKey: 'pracovni' })),
    ];
    expect(buildCharacterMix(own, profiles, characters, 10)[0].status).toBe('ok');
    const near = [...own.slice(1), video({ profileKey: 'honza', characterKey: 'pracovni' })]; // 6/10 = 60 %
    expect(buildCharacterMix(near, profiles, characters, 10)[0].status).toBe('ok');
    expect(buildCharacterMix(near, profiles, characters, 5)[0].status).toBe('out');
  });
});
