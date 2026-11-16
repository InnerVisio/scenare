import { describe, expect, it } from 'vitest';
import { cycleLabel, shootDayLabel, weekdayShortDateYear } from '@/domain/format/date';
import { leadershipStatus } from '@/domain/workflow/leadershipStatus';

const approve = (userId: string) => ({ userId, decision: 'approve' as const });

describe('leadershipStatus', () => {
  it('awaiting and not approved by me → Čeká na tebe', () => {
    expect(leadershipStatus({ approvalStatus: 'in_review' }, 'me', [approve('other')], 'Radek')).toMatchObject({ group: 'me', label: 'Čeká na tebe', tone: 'apricot' });
  });
  it('approved by me, other pending → Čeká na <jméno>', () => {
    expect(leadershipStatus({ approvalStatus: 'in_review' }, 'me', [approve('me')], 'Radek')).toMatchObject({ group: 'other', label: 'Čeká na Radka', tone: 'lavender' });
    expect(leadershipStatus({ approvalStatus: 'in_review' }, 'me', [approve('me')], 'Honza').label).toBe('Čeká na Honzu');
  });
  it('final_review adds the sub-label', () => {
    expect(leadershipStatus({ approvalStatus: 'final_review' }, 'me', []).sub).toBe('upraveno podle připomínek');
    expect(leadershipStatus({ approvalStatus: 'in_review' }, 'me', []).sub).toBeUndefined();
  });
  it('maps the other statuses', () => {
    const l = (approvalStatus: 'approved' | 'returned' | 'draft' | 'postponed' | 'cancelled') => leadershipStatus({ approvalStatus }, 'me', []);
    expect(l('approved')).toMatchObject({ label: 'Schváleno – točíme', tone: 'lime', group: 'approved' });
    expect(l('returned')).toMatchObject({ label: 'Admin upravuje', group: 'admin' });
    expect(l('draft')).toMatchObject({ label: 'Admin píše', group: 'admin' });
    expect(l('postponed')).toMatchObject({ label: 'Odloženo', group: 'muted' });
    expect(l('cancelled')).toMatchObject({ label: 'Zrušeno', group: 'muted' });
  });
});

describe('cycleLabel / shootDayLabel', () => {
  it('shows the shooting day', () => {
    expect(cycleLabel({ id: '2026-11', shootDate: '2026-11-20' })).toBe('Natáčení 20. 11. (pá)');
    expect(cycleLabel({ id: '2026-11', shootDate: null })).toBe('Natáčení 2026-11 · bez data');
  });
  it('words the shooting day with the countdown', () => {
    const now = new Date('2026-11-15T10:00:00+01:00');
    expect(shootDayLabel('2026-11-20', now)).toBe('pá 20. 11. · zbývá 5 dní');
    expect(shootDayLabel('2026-11-16', now)).toBe('po 16. 11. · zbývá 1 den');
    expect(shootDayLabel('2026-11-15', now)).toBe('ne 15. 11. · dnes');
    expect(shootDayLabel('2026-11-10', now)).toBe('út 10. 11. · už proběhlo');
  });
});

describe('weekdayShortDateYear', () => {
  it('adds weekday and year', () => {
    expect(weekdayShortDateYear('2026-11-20')).toBe('pá 20. 11. 2026');
  });
});
