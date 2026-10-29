import { describe, expect, it } from 'vitest';
import {
  activeMention,
  approvalLine,
  checkSummary,
  decisionToast,
  defaultCenterView,
  groupThreads,
  matchMentionUsers,
  mentionedIds,
  nextUndecidedCode,
  unresolvedLabel,
} from '@/app/(app)/_components/review/model';
import type { CheckResult } from '@/domain/checks/runChecks';
import type { ThreadVM } from '@/server/review';

const thread = (index: number, status: ThreadVM['status'], isDetached = false) => ({ index, status, isDetached }) as ThreadVM;

describe('unresolvedLabel', () => {
  it('declines in Czech', () => {
    expect([1, 2, 4, 5, 0].map(unresolvedLabel)).toEqual([
      '1 nevyřešený',
      '2 nevyřešené',
      '4 nevyřešené',
      '5 nevyřešených',
      '0 nevyřešených',
    ]);
  });
});

describe('groupThreads', () => {
  it('puts open first, then addressed, then closed, and splits off detached ones', () => {
    const { attached, detached } = groupThreads([
      thread(1, 'addressed'),
      thread(2, 'open'),
      thread(3, 'closed'),
      thread(4, 'open'),
      thread(5, 'open', true),
    ]);
    expect(attached.map((t) => t.index)).toEqual([2, 4, 1, 3]);
    expect(detached.map((t) => t.index)).toEqual([5]);
  });
});

describe('checkSummary', () => {
  it('counts pass and manual_done', () => {
    const c = (status: CheckResult['status']) => ({ status }) as CheckResult;
    expect(checkSummary([c('pass'), c('manual_done'), c('fail'), c('manual_pending'), c('empty')])).toEqual({ passed: 2, total: 5 });
  });
});

describe('approvalLine', () => {
  const base = { state: 'pending' as const, approvedNames: [], waitingFor: ['Honza', 'Radek'], required: 2, actorApproved: false };
  it('is empty before anyone decided', () => {
    expect(approvalLine(base).text).toBeNull();
  });
  it('shows progress and who is awaited', () => {
    expect(approvalLine({ ...base, approvedNames: ['Honza'], waitingFor: ['Radek'] }).text).toBe('Schváleno 1/2 · čeká na Radka');
  });
  it('says „čeká na tebe“ when the actor is the one awaited', () => {
    expect(approvalLine({ ...base, approvedNames: ['Honza'], waitingFor: ['Radek'] }, 'Radek').text).toBe('Schváleno 1/2 · čeká na tebe');
    expect(approvalLine({ ...base, approvedNames: ['Honza'], waitingFor: ['Radek'] }, 'Admin').text).toBe('Schváleno 1/2 · čeká na Radka');
  });
  it('speaks to the actor who approved', () => {
    expect(approvalLine({ ...base, approvedNames: ['Radek'], waitingFor: ['Honza'], actorApproved: true })).toEqual({
      text: 'Schválil jsi · čeká na Honzu',
      actorApproved: true,
    });
  });
});

describe('nextUndecidedCode', () => {
  const q = (...items: [string, boolean][]) => items.map(([code, decidedByActor]) => ({ code, decidedByActor }));
  it('prefers the next undecided item after the current one', () => {
    expect(nextUndecidedCode(q(['A', false], ['B', false], ['C', false]), 'A')).toBe('B');
    expect(nextUndecidedCode(q(['A', false], ['B', true], ['C', false]), 'A')).toBe('C');
  });
  it('wraps to an earlier undecided item', () => {
    expect(nextUndecidedCode(q(['A', false], ['B', false], ['C', true]), 'B')).toBe('A');
  });
  it('is null when nothing is left, or the current script is not in the queue', () => {
    expect(nextUndecidedCode(q(['A', false]), 'A')).toBeNull();
    expect(nextUndecidedCode(q(['A', true], ['B', true]), 'A')).toBeNull();
    expect(nextUndecidedCode(q(['A', false]), 'Z')).toBe('A');
  });
});

describe('decisionToast', () => {
  it('describes each outcome', () => {
    expect(decisionToast('return', { state: 'returned', waitingFor: [] })).toBe('Vráceno k dopracování');
    expect(decisionToast('approve', { state: 'approved', waitingFor: [] })).toBe('Schváleno oběma ✓');
    expect(decisionToast('approve', { state: 'pending', waitingFor: ['Radek'] })).toBe('Schváleno · čeká na Radka');
  });
});

describe('defaultCenterView', () => {
  it('opens the changes since the last seen version when there is a newer one', () => {
    expect(defaultCenterView(1, 2)).toEqual({ view: 'diff', base: 1 });
  });
  it('opens the current version otherwise', () => {
    expect(defaultCenterView(2, 2)).toEqual({ view: 'read', base: null });
    expect(defaultCenterView(null, 2)).toEqual({ view: 'read', base: null });
    expect(defaultCenterView(1, null)).toEqual({ view: 'read', base: null });
  });
});

describe('mentions', () => {
  const users = [
    { id: 'u1', name: 'Honza' },
    { id: 'u2', name: 'Radek' },
    { id: 'u3', name: 'Řehoř' },
  ];

  it('finds the @query before the caret', () => {
    expect(activeMention('Ahoj @Ho', 8)).toEqual({ query: 'Ho', start: 5 });
    expect(activeMention('@', 1)).toEqual({ query: '', start: 0 });
    expect(activeMention('mail@Ho', 7)).toBeNull();
    expect(activeMention('Ahoj @Honza hotovo', 18)).toBeNull();
  });

  it('matches users by name prefix ignoring diacritics', () => {
    expect(matchMentionUsers(users, 'ho').map((u) => u.id)).toEqual(['u1']);
    expect(matchMentionUsers(users, 'reh').map((u) => u.id)).toEqual(['u3']);
    expect(matchMentionUsers(users, '').map((u) => u.id)).toEqual(['u1', 'u2', 'u3']);
  });

  it('lists the users still mentioned in the text', () => {
    expect(mentionedIds('@Honza mrkni na to, díky @Radek', users)).toEqual(['u1', 'u2']);
    expect(mentionedIds('@Honzaa není Honza, e-mail a@Radek', users)).toEqual([]);
    expect(mentionedIds('bez zmínky', users)).toEqual([]);
  });
});
