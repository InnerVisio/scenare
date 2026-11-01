import { describe, expect, it } from 'vitest';
import { checkPublicationUrl, formatRate, metricRates, normalizeMetrics } from '@/domain/metrics/publication';

describe('metricRates', () => {
  it('divides shares, saves and comments by reach', () => {
    expect(metricRates({ reach: 1000, shares: 25, saves: 50, comments: 5 })).toEqual({ shareRate: 0.025, saveRate: 0.05, commentRate: 0.005 });
  });
  it('is null without reach or the numerator', () => {
    expect(metricRates({ shares: 5 })).toEqual({ shareRate: null, saveRate: null, commentRate: null });
    expect(metricRates({ reach: 0, shares: 5 }).shareRate).toBeNull();
    expect(metricRates({ reach: 200, saves: 4 })).toEqual({ shareRate: null, saveRate: 0.02, commentRate: null });
    expect(metricRates(null).shareRate).toBeNull();
  });
});

describe('formatRate', () => {
  it('prints a Czech percentage with a comma and one decimal', () => {
    expect(formatRate(0.0325)).toBe('3,3 %');
    expect(formatRate(0.5)).toBe('50 %');
    expect(formatRate(null)).toBe('—');
  });
});

describe('normalizeMetrics', () => {
  it('keeps filled numbers and returns null when nothing is filled', () => {
    expect(normalizeMetrics({ views: 1200, reach: '900', shares: '' })).toEqual({ ok: true, metrics: { views: 1200, reach: 900 } });
    expect(normalizeMetrics({})).toEqual({ ok: true, metrics: null });
    expect(normalizeMetrics(null)).toEqual({ ok: true, metrics: null });
  });
  it('ignores unknown keys', () => {
    expect(normalizeMetrics({ foo: 4, reach: 3 })).toEqual({ ok: true, metrics: { reach: 3 } });
  });
  it('refuses negative, fractional counts and a skip rate above 100', () => {
    expect(normalizeMetrics({ reach: -1 })).toMatchObject({ ok: false });
    expect(normalizeMetrics({ shares: 1.5 })).toMatchObject({ ok: false });
    expect(normalizeMetrics({ skipRate: 101 })).toMatchObject({ ok: false, message: 'Míra přeskočení musí být od 0 do 100 %.' });
    expect(normalizeMetrics({ reach: 'abc' })).toMatchObject({ ok: false });
    expect(normalizeMetrics({ skipRate: 33.5, avgWatchSec: 7.25 })).toEqual({ ok: true, metrics: { skipRate: 33.5, avgWatchSec: 7.25 } });
  });
});

describe('checkPublicationUrl', () => {
  it('allows an empty link and http(s) links only', () => {
    expect(checkPublicationUrl('')).toBeNull();
    expect(checkPublicationUrl('https://www.tiktok.com/@gta/video/1')).toBeNull();
    expect(checkPublicationUrl('javascript:alert(1)')).toBe('Odkaz musí začínat http:// nebo https://.');
    expect(checkPublicationUrl('tiktok.com/x')).toBe('Odkaz musí začínat http:// nebo https://.');
  });
});

describe('Prague date-time input', () => {
  it('round-trips winter and summer time', async () => {
    const { parsePragueDateTime, toPragueDateTimeInput } = await import('@/domain/format/pragueLocal');
    expect(parsePragueDateTime('2026-11-21T10:00')?.toISOString()).toBe('2026-11-21T09:00:00.000Z');
    expect(parsePragueDateTime('2026-07-01T10:00')?.toISOString()).toBe('2026-07-01T08:00:00.000Z');
    expect(toPragueDateTimeInput(new Date('2026-11-21T09:05:00Z'))).toBe('2026-11-21T10:05');
    expect(parsePragueDateTime('2026-11-21T09:00:00.000Z')?.toISOString()).toBe('2026-11-21T09:00:00.000Z');
    expect(parsePragueDateTime('včera')).toBeNull();
  });
});

describe('groupVariants', () => {
  it('keeps only videos published in more than one variant', async () => {
    const { groupVariants } = await import('@/domain/metrics/publication');
    const rows = [
      { videoId: 'a', variant: 'hook-a' },
      { videoId: 'a', variant: 'hook-b' },
      { videoId: 'b', variant: 'hlavni-verze' },
      { videoId: 'b', variant: 'hlavni-verze' },
      { videoId: 'c', variant: 'hlavni-verze' },
    ];
    const groups = groupVariants(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0].map((r) => r.variant)).toEqual(['hook-a', 'hook-b']);
  });
});
