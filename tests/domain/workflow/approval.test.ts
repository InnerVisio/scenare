import { describe, expect, it } from 'vitest';
import {
  APPROVAL_STATUSES,
  APPROVAL_STATUS_LABELS,
  canSubmit,
  evaluateDecisions,
  isAwaitingDecision,
  statusAfterSubmit,
  type ApprovalPolicy,
  type ApprovalStatus,
  type Decision,
} from '@/domain/workflow/approval';

const H = 'honza';
const R = 'radek';

function evaluate(
  policy: ApprovalPolicy,
  decisions: Decision[],
  seriesGuarantorId: string | null = null,
  leadershipUserIds: string[] = [H, R],
) {
  return evaluateDecisions({ policy, leadershipUserIds, seriesGuarantorId, decisions });
}

describe('APPROVAL_STATUS_LABELS', () => {
  it('has a Czech label for every status', () => {
    expect(APPROVAL_STATUS_LABELS).toEqual({
      draft: 'Rozpracováno',
      in_review: 'K připomínkám',
      returned: 'K dopracování',
      final_review: 'K finálnímu schválení',
      approved: 'Schváleno',
      postponed: 'Odloženo',
      cancelled: 'Zrušeno',
    });
    expect(Object.keys(APPROVAL_STATUS_LABELS)).toEqual([...APPROVAL_STATUSES]);
  });
});

describe('canSubmit', () => {
  const cases: [ApprovalStatus, boolean, boolean][] = [
    ['draft', false, true],
    ['draft', true, true],
    ['in_review', false, false],
    ['in_review', true, false],
    ['returned', false, true],
    ['returned', true, true],
    ['final_review', false, false],
    ['final_review', true, false],
    ['approved', false, false],
    ['approved', true, true],
    ['postponed', false, false],
    ['postponed', true, false],
    ['cancelled', false, false],
    ['cancelled', true, false],
  ];
  it.each(cases)('%s with editingAfterApproval=%s -> %s', (status, editingAfterApproval, expected) => {
    expect(canSubmit({ status, editingAfterApproval })).toBe(expected);
  });
  it('covers every status', () => {
    expect(new Set(cases.map(([s]) => s))).toEqual(new Set(APPROVAL_STATUSES));
  });
});

describe('statusAfterSubmit', () => {
  it('goes to in_review for a first version', () => {
    expect(statusAfterSubmit(false)).toBe('in_review');
  });
  it('goes to final_review when a previous version exists', () => {
    expect(statusAfterSubmit(true)).toBe('final_review');
  });
});

describe('isAwaitingDecision', () => {
  const cases: [ApprovalStatus, boolean][] = [
    ['draft', false],
    ['in_review', true],
    ['returned', false],
    ['final_review', true],
    ['approved', false],
    ['postponed', false],
    ['cancelled', false],
  ];
  it.each(cases)('%s -> %s', (status, expected) => {
    expect(isAwaitingDecision(status)).toBe(expected);
  });
});

describe('evaluateDecisions: all_leadership', () => {
  it('is pending with no decisions', () => {
    expect(evaluate('all_leadership', [])).toEqual({
      state: 'pending',
      approvedBy: [],
      waitingFor: [H, R],
    });
  });
  it('is pending when only Honza approved', () => {
    expect(evaluate('all_leadership', [{ userId: H, decision: 'approve' }])).toEqual({
      state: 'pending',
      approvedBy: [H],
      waitingFor: [R],
    });
  });
  it('is approved when Honza and Radek approved', () => {
    expect(
      evaluate('all_leadership', [
        { userId: H, decision: 'approve' },
        { userId: R, decision: 'approve' },
      ]),
    ).toEqual({ state: 'approved', approvedBy: [H, R], waitingFor: [] });
  });
  it('is returned when Honza approved and Radek returned', () => {
    expect(
      evaluate('all_leadership', [
        { userId: H, decision: 'approve' },
        { userId: R, decision: 'return' },
      ]),
    ).toEqual({ state: 'returned', approvedBy: [H], waitingFor: [] });
  });
  it('lets the latest decision per user win (return then approve)', () => {
    expect(
      evaluate('all_leadership', [
        { userId: H, decision: 'return' },
        { userId: H, decision: 'approve' },
        { userId: R, decision: 'approve' },
      ]),
    ).toEqual({ state: 'approved', approvedBy: [H, R], waitingFor: [] });
  });
  it('lets the latest decision per user win (approve then return)', () => {
    expect(
      evaluate('all_leadership', [
        { userId: H, decision: 'approve' },
        { userId: R, decision: 'approve' },
        { userId: H, decision: 'return' },
      ]),
    ).toEqual({ state: 'returned', approvedBy: [R], waitingFor: [] });
  });
  it('lists approvedBy in leadershipUserIds order', () => {
    expect(
      evaluate('all_leadership', [
        { userId: R, decision: 'approve' },
        { userId: H, decision: 'approve' },
      ]).approvedBy,
    ).toEqual([H, R]);
  });
  it('ignores decisions from users outside leadership', () => {
    expect(
      evaluate('all_leadership', [
        { userId: 'admin', decision: 'approve' },
        { userId: 'marketer', decision: 'return' },
        { userId: H, decision: 'approve' },
      ]),
    ).toEqual({ state: 'pending', approvedBy: [H], waitingFor: [R] });
  });
});

describe('evaluateDecisions: any_leadership', () => {
  it('is approved with one approval', () => {
    expect(evaluate('any_leadership', [{ userId: R, decision: 'approve' }])).toEqual({
      state: 'approved',
      approvedBy: [R],
      waitingFor: [],
    });
  });
  it('is pending with no decisions', () => {
    expect(evaluate('any_leadership', [])).toEqual({
      state: 'pending',
      approvedBy: [],
      waitingFor: [H, R],
    });
  });
  it('is returned when anyone returned, even over an approval', () => {
    expect(
      evaluate('any_leadership', [
        { userId: H, decision: 'approve' },
        { userId: R, decision: 'return' },
      ]).state,
    ).toBe('returned');
  });
});

describe('evaluateDecisions: series_guarantor', () => {
  it('is approved when the guarantor approved', () => {
    expect(evaluate('series_guarantor', [{ userId: R, decision: 'approve' }], R)).toEqual({
      state: 'approved',
      approvedBy: [R],
      waitingFor: [],
    });
  });
  it('is pending while the guarantor has not decided, even if another leader approved', () => {
    expect(evaluate('series_guarantor', [{ userId: H, decision: 'approve' }], R)).toEqual({
      state: 'pending',
      approvedBy: [H],
      waitingFor: [R],
    });
  });
  it('is returned when any leader returned', () => {
    expect(
      evaluate(
        'series_guarantor',
        [
          { userId: R, decision: 'approve' },
          { userId: H, decision: 'return' },
        ],
        R,
      ).state,
    ).toBe('returned');
  });
  it('falls back to any_leadership without a guarantor', () => {
    expect(evaluate('series_guarantor', [{ userId: H, decision: 'approve' }], null)).toEqual({
      state: 'approved',
      approvedBy: [H],
      waitingFor: [],
    });
    expect(evaluate('series_guarantor', [], null)).toEqual({
      state: 'pending',
      approvedBy: [],
      waitingFor: [H, R],
    });
  });
});

describe('evaluateDecisions: edge cases', () => {
  it('never approves when there is no leadership', () => {
    expect(evaluate('all_leadership', [], null, [])).toEqual({
      state: 'pending',
      approvedBy: [],
      waitingFor: [],
    });
  });
  it('stays pending when the guarantor is not a leadership user', () => {
    expect(evaluate('series_guarantor', [{ userId: 'x', decision: 'approve' }], 'x').state).toBe(
      'pending',
    );
  });
});
