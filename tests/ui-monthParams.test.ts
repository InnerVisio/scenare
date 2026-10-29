import { describe, expect, it } from 'vitest';
import { cycleLabel, monthLabel, monthsAround, parseCycleParam, parseMonthParam } from '@/ui/monthParams';

describe('parseMonthParam', () => {
  it('accepts valid months and falls back otherwise', () => {
    expect(parseMonthParam('2026-11', '2026-10')).toBe('2026-11');
    expect(parseMonthParam('abc', '2026-10')).toBe('2026-10');
    expect(parseMonthParam('2026-13', '2026-10')).toBe('2026-10');
    expect(parseMonthParam('2026-00', '2026-10')).toBe('2026-10');
    expect(parseMonthParam('2026-1', '2026-10')).toBe('2026-10');
    expect(parseMonthParam(null, '2026-10')).toBe('2026-10');
    expect(parseMonthParam('', '2026-10')).toBe('2026-10');
  });
});

describe('parseCycleParam', () => {
  it('requires a valid format and a known cycle', () => {
    expect(parseCycleParam('2026-11', ['2026-11'], '2026-12')).toBe('2026-11');
    expect(parseCycleParam('2027-01', ['2026-11'], '2026-12')).toBe('2026-12');
    expect(parseCycleParam('abc', ['abc'], null)).toBeNull();
  });
});

describe('labels', () => {
  it('formats months in Czech', () => {
    expect(monthLabel('2026-11')).toBe('Listopad 2026');
    expect(monthLabel('2026-10')).toBe('Říjen 2026');
    expect(cycleLabel('2026-11')).toBe('Cyklus 2026–11');
  });

  it('lists 6 months back and forward across year ends', () => {
    const months = monthsAround('2026-11');
    expect(months).toHaveLength(13);
    expect(months[0]).toBe('2026-05');
    expect(months[6]).toBe('2026-11');
    expect(months[12]).toBe('2027-05');
  });
});
