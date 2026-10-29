import { describe, expect, it } from 'vitest';
import { joinAccusative, toAccusative } from '@/domain/format/names';

describe('toAccusative', () => {
  it.each([
    ['Honza', 'Honzu'],
    ['Radek', 'Radka'],
    ['Petr', 'Petra'],
    ['Pavel', 'Pavla'],
    ['Admin', 'Admina'],
    ['Jana', 'Janu'],
  ])('%s → %s', (name, expected) => expect(toAccusative(name)).toBe(expected));

  it('leaves vowel-ending non-a names alone', () => {
    expect(toAccusative('Marie')).toBe('Marie');
  });
});

describe('joinAccusative', () => {
  it('joins with commas and "a"', () => {
    expect(joinAccusative([])).toBe('');
    expect(joinAccusative(['Radek'])).toBe('Radka');
    expect(joinAccusative(['Honza', 'Radek'])).toBe('Honzu a Radka');
    expect(joinAccusative(['Honza', 'Radek', 'Petr'])).toBe('Honzu, Radka a Petra');
  });
});
