import { describe, expect, it } from 'vitest';
import { parseListQuery, rowTone, toListHref } from '@/app/(app)/scenare/listModel';

describe('rowTone', () => {
  const today = '2026-10-29';
  it('is coral for returned scripts and for overdue ones that are not decided', () => {
    expect(rowTone({ approvalStatus: 'returned', scriptDueDate: null }, today)).toBe('coral');
    expect(rowTone({ approvalStatus: 'draft', scriptDueDate: '2026-10-28' }, today)).toBe('coral');
    expect(rowTone({ approvalStatus: 'in_review', scriptDueDate: '2026-10-01' }, today)).toBe('coral');
  });
  it('is not overdue on the due day itself or when the script is approved, postponed or cancelled', () => {
    expect(rowTone({ approvalStatus: 'draft', scriptDueDate: '2026-10-29' }, today)).toBeNull();
    expect(rowTone({ approvalStatus: 'approved', scriptDueDate: '2026-10-01' }, today)).toBe('lime');
    expect(rowTone({ approvalStatus: 'postponed', scriptDueDate: '2026-10-01' }, today)).toBeNull();
    expect(rowTone({ approvalStatus: 'cancelled', scriptDueDate: '2026-10-01' }, today)).toBeNull();
  });
  it('is apricot while awaiting a decision, lime when approved, none otherwise', () => {
    expect(rowTone({ approvalStatus: 'in_review', scriptDueDate: null }, today)).toBe('apricot');
    expect(rowTone({ approvalStatus: 'final_review', scriptDueDate: '2026-11-13' }, today)).toBe('apricot');
    expect(rowTone({ approvalStatus: 'approved', scriptDueDate: null }, today)).toBe('lime');
    expect(rowTone({ approvalStatus: 'draft', scriptDueDate: null }, today)).toBeNull();
  });
});

describe('parseListQuery', () => {
  const known = { cycleIds: ['2026-11'], categoryKeys: ['nabor', 'produkt'], seriesIds: ['ser-a'] };
  it('keeps valid values and drops unknown ones', () => {
    expect(
      parseListQuery(
        { cyklus: '2026-11', mesic: '2026-12', kategorie: 'produkt', stav: 'returned', vyroba: 'shot', serie: 'ser-a', q: ' fixace ' },
        known,
      ),
    ).toEqual({ cyklus: '2026-11', mesic: '2026-12', kategorie: 'produkt', stav: 'returned', vyroba: 'shot', serie: 'ser-a', q: 'fixace' });
    expect(
      parseListQuery({ cyklus: '2027-01', mesic: 'abc', kategorie: 'x', stav: 'nope', vyroba: 'nope', serie: 'zzz', q: '   ' }, known),
    ).toEqual({});
  });
  it('takes the first value of a repeated parameter', () => {
    expect(parseListQuery({ stav: ['approved', 'draft'] }, known)).toEqual({ stav: 'approved' });
  });
});

describe('toListHref', () => {
  it('builds a query string from the set filters only', () => {
    expect(toListHref({})).toBe('/scenare');
    expect(toListHref({ stav: 'returned', q: 'fixace hypotéky' })).toBe('/scenare?stav=returned&q=fixace+hypot%C3%A9ky');
  });
});
