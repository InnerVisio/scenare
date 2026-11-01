import { describe, expect, it } from 'vitest';
import { crewView, groupForShooting, hooksToShoot, shootingWarnings, type ShootingVideo } from '@/domain/shooting/plan';
import type { ScriptBody } from '@/domain/script/types';

const body = (over: Partial<ScriptBody> = {}): ScriptBody => ({
  hooks: [
    { id: 'A', hookType: null, text: 'Hook A', visual: '' },
    { id: 'B', hookType: null, text: '', visual: '' },
    { id: 'C', hookType: null, text: '', visual: 'Detail ruky' },
  ],
  scenes: [
    {
      id: 's1',
      fromSec: 0,
      toSec: 5,
      visual: 'Kancelář',
      lines: [
        { id: 'l1', speaker: 'Radek', direction: 'do kamery', text: 'Ahoj.' },
        { id: 'l2', speaker: 'Honza', direction: '', text: 'Čau.' },
        { id: 'l3', speaker: 'Radek', direction: '', text: 'Jedeme.' },
      ],
    },
  ],
  cta: null,
  caption: 'Interní popisek',
  hashtags: [],
  viewerLearns: '',
  source: '',
  differsFromLast3: '',
  ...over,
});

const video = (code: string, over: Partial<ShootingVideo> = {}): ShootingVideo => ({
  id: code,
  code,
  title: `Video ${code}`,
  locationKeys: ['kancelar'],
  cast: [],
  props: '',
  formatKey: null,
  productionStatus: 'waiting',
  body: body(),
  ...over,
});

const labels = new Map([
  ['kancelar', 'Kancelář'],
  ['recepce', 'Recepce'],
]);

describe('hooksToShoot', () => {
  it('lists hooks with a text or a visual', () => {
    expect(hooksToShoot(body())).toEqual(['A', 'C']);
  });
});

describe('groupForShooting', () => {
  it('groups by the first location, then by cast taken from the spoken lines', () => {
    const groups = groupForShooting(
      [
        video('V002', { locationKeys: ['recepce'] }),
        video('V003'),
        video('V001', { body: body({ scenes: [{ id: 's', fromSec: 0, toSec: 1, visual: '', lines: [{ id: 'x', speaker: 'Honza', direction: '', text: 'Sám.' }] }] }) }),
      ],
      labels,
    );
    expect(groups.map((g) => g.label)).toEqual(['Kancelář', 'Recepce']);
    const office = groups[0];
    expect(office.castGroups.map((c) => [c.label, c.items.map((i) => i.code)])).toEqual([
      ['Honza', ['V001']],
      ['Honza + Radek', ['V003']],
    ]);
  });

  it('puts videos without a location last and falls back to the video cast without lines', () => {
    const groups = groupForShooting(
      [video('V001', { locationKeys: [], body: null, cast: ['Petr'] }), video('V002')],
      labels,
    );
    expect(groups.map((g) => g.label)).toEqual(['Kancelář', 'Bez lokace']);
    expect(groups[1].castGroups[0]).toMatchObject({ label: 'Petr' });
  });

  it('labels an empty cast and counts items', () => {
    const [group] = groupForShooting([video('V001', { body: null })], labels);
    expect(group.castGroups[0].label).toBe('Bez obsazení');
    expect(group.count).toBe(1);
  });
});

describe('crewView', () => {
  it('has hooks and spoken lines only', () => {
    const view = crewView(body());
    expect(view.hooks).toEqual([
      { id: 'A', text: 'Hook A', visual: '' },
      { id: 'C', text: '', visual: 'Detail ruky' },
    ]);
    expect(view.lines.map((l) => [l.speaker, l.text])).toEqual([['Radek', 'Ahoj.'], ['Honza', 'Čau.'], ['Radek', 'Jedeme.']]);
    expect(JSON.stringify(view)).not.toContain('Interní popisek');
  });
});

describe('shootingWarnings', () => {
  const mixRow = (label: string, missing: number) => ({ label, missing });
  it('is quiet before the deadline and with a full mix', () => {
    expect(shootingWarnings({ daysToDeadline: 3, statuses: ['in_review'], missing: [mixRow('Trendy', 0)] })).toEqual([]);
  });
  it('warns about unapproved scripts after the deadline (postponed and cancelled do not count)', () => {
    const w = shootingWarnings({ daysToDeadline: -1, statuses: ['approved', 'in_review', 'draft', 'cancelled', 'postponed'], missing: [] });
    expect(w).toEqual(['Termín schválení už uplynul a 2 scénáře nejsou schválené.']);
  });
  it('lists missing categories', () => {
    const w = shootingWarnings({ daysToDeadline: null, statuses: [], missing: [mixRow('Trendy', 2), mixRow('Produkt', 0), mixRow('Edu', 1)] });
    expect(w).toEqual(['Chybí schválené scénáře: Trendy 2, Edu 1.']);
  });
});
