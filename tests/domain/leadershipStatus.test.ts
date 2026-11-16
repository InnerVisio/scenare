import { describe, expect, it } from 'vitest';
import { cycleLabel, shootDayLabel, weekdayShortDateYear } from '@/domain/format/date';
import { leadershipDot, leadershipStatus } from '@/domain/workflow/leadershipStatus';

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
    expect(l('draft').sub).toBe('Ještě neodesláno ke kontrole');
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

describe('leadershipDot', () => {
  const dot = (approvalStatus: Parameters<typeof leadershipDot>[0]['approvalStatus'], decisions = [] as ReturnType<typeof approve>[], other: string | null = null) =>
    leadershipDot({ approvalStatus }, 'me', decisions, other);
  it('yellow: awaiting and not approved by me → review', () => {
    expect(dot('in_review')).toMatchObject({ color: 'yellow', label: 'Ke kontrole', target: 'review', rank: 0 });
    expect(dot('final_review', [approve('other')])).toMatchObject({ color: 'yellow', target: 'review' });
  });
  it('red: returned → script, Admin opravuje', () => {
    expect(dot('returned')).toMatchObject({ color: 'red', label: 'Zamítnuto – Admin opravuje', target: 'script', rank: 1 });
  });
  it('green: approved by me, other pending → still review, with sub', () => {
    expect(dot('in_review', [approve('me')], 'Honza')).toMatchObject({ color: 'green', label: 'Zkontrolováno', sub: 'čeká na Honzu', target: 'review', rank: 2 });
  });
  it('green: fully approved → script', () => {
    expect(dot('approved')).toMatchObject({ color: 'green', label: 'Schváleno', target: 'script' });
  });
  it('grey: draft → Admin ještě píše', () => {
    expect(dot('draft')).toMatchObject({ color: 'grey', label: 'Admin ještě píše', target: 'script', rank: 3 });
  });
  it('postponed / cancelled have no dot', () => {
    expect(dot('postponed')).toBeNull();
    expect(dot('cancelled')).toBeNull();
  });
});
