import { describe, expect, it } from 'vitest';
import { daysUntil, formatDate, pragueDay, formatDateTime, formatDayMonth, formatRelative, formatTime } from '@/domain/format/date';
import { newId } from '@/domain/ids';

describe('formatDate', () => {
  it('formats as "29. 10. 2026" in Europe/Prague', () => {
    expect(formatDate(new Date('2026-10-29T10:00:00Z'))).toBe('29. 10. 2026');
  });

  it('uses the Prague calendar day, not UTC', () => {
    expect(formatDate(new Date('2026-10-29T23:30:00Z'))).toBe('30. 10. 2026');
  });
});

describe('formatDateTime', () => {
  it('formats date and 24h time in Europe/Prague', () => {
    expect(formatDateTime(new Date('2026-10-29T20:40:00Z'))).toBe('29. 10. 2026 21:40');
  });

  it('handles summer time (CEST)', () => {
    expect(formatDateTime(new Date('2026-07-01T07:05:00Z'))).toBe('1. 7. 2026 09:05');
  });
});

describe('daysUntil', () => {
  it('counts calendar days between Prague dates', () => {
    const target = new Date('2026-11-20T00:00:00+01:00');
    const now = new Date('2026-10-29T09:00:00+01:00');
    expect(daysUntil(target, now)).toBe(22);
  });

  it('is 0 on the same Prague day and negative in the past', () => {
    const now = new Date('2026-10-29T09:00:00+01:00');
    expect(daysUntil(new Date('2026-10-29T23:00:00+01:00'), now)).toBe(0);
    expect(daysUntil(new Date('2026-10-27T12:00:00+01:00'), now)).toBe(-2);
  });

  it('spans the DST change correctly', () => {
    const now = new Date('2026-10-20T12:00:00+02:00');
    const target = new Date('2026-11-01T12:00:00+01:00');
    expect(daysUntil(target, now)).toBe(12);
  });
});

describe('newId', () => {
  it('returns 12 URL-safe characters', () => {
    expect(newId()).toMatch(/^[A-Za-z0-9_-]{12}$/);
  });

  it('is unique across 1000 calls', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId()));
    expect(ids.size).toBe(1000);
  });
});

describe('formatDayMonth / formatTime', () => {
  it('formats the Prague day and month without year', () => {
    expect(formatDayMonth(new Date('2026-11-20T00:00:00+01:00'))).toBe('20. 11.');
  });

  it('formats the Prague time with an unpadded hour', () => {
    expect(formatTime(new Date('2026-10-29T06:12:00Z'))).toBe('7:12');
    expect(formatTime(new Date('2026-10-29T20:40:00Z'))).toBe('21:40');
  });
});

describe('formatRelative', () => {
  const now = new Date('2026-10-29T10:00:00+01:00');
  it('says today and yesterday', () => {
    expect(formatRelative(new Date('2026-10-29T07:12:00+01:00'), now)).toBe('dnes 7:12');
    expect(formatRelative(new Date('2026-10-28T21:40:00+01:00'), now)).toBe('včera 21:40');
  });

  it('uses the Prague calendar day around midnight', () => {
    expect(formatRelative(new Date('2026-10-28T23:30:00Z'), now)).toBe('dnes 0:30');
  });

  it('falls back to a short date, with the year only when it differs', () => {
    expect(formatRelative(new Date('2026-10-20T09:05:00+02:00'), now)).toBe('20. 10. 9:05');
    expect(formatRelative(new Date('2025-12-24T09:05:00+01:00'), now)).toBe('24. 12. 2025 9:05');
  });
});

describe('pragueDay', () => {
  it('is the Prague calendar day as YYYY-MM-DD', () => {
    expect(pragueDay(new Date('2026-10-29T10:00:00Z'))).toBe('2026-10-29');
    expect(pragueDay(new Date('2026-10-29T23:30:00Z'))).toBe('2026-10-30');
  });
});
