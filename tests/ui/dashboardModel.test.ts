import { describe, expect, it } from 'vitest';
import { dateLine, greeting, inDays } from '@/app/(app)/_components/dashboard/model';

describe('dashboard model', () => {
  it('greets by Prague hour', () => {
    expect(greeting(new Date('2026-10-29T07:00:00+01:00'), 'Honza')).toBe('Dobré ráno, Honza');
    expect(greeting(new Date('2026-10-29T14:00:00+01:00'), 'Honza')).toBe('Dobré odpoledne, Honza');
    expect(greeting(new Date('2026-10-29T21:00:00+01:00'), 'Honza')).toBe('Dobrý večer, Honza');
  });

  it('formats the date line and day counts', () => {
    expect(dateLine(new Date('2026-10-29T10:00:00+01:00'), 22)).toBe('Čtvrtek 29. 10. 2026 · do natáčení zbývá 22 dní');
    expect(dateLine(new Date('2026-10-29T10:00:00+01:00'), 3)).toContain('zbývají 3 dny');
    expect(inDays(15)).toBe('za 15 dní');
    expect(inDays(1)).toBe('za 1 den');
  });
});
