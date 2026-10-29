import { describe, expect, it } from 'vitest';
import { progressLine, failingChecks } from '@/app/(app)/scenare/[code]/detailModel';

const approval = (over: Partial<Parameters<typeof progressLine>[1]> = {}) => ({
  state: 'pending' as const,
  approvedNames: [] as string[],
  waitingFor: ['Honza', 'Radek'],
  required: 2,
  actorApproved: false,
  ...over,
});

describe('progressLine', () => {
  it('says who is awaited while leaders decide', () => {
    expect(progressLine('in_review', approval(), 'Admin')).toEqual({ text: 'Čeká na Honzu a Radka', done: 0, total: 2 });
    expect(progressLine('final_review', approval({ approvedNames: ['Honza'], waitingFor: ['Radek'] }), 'Admin')).toEqual({
      text: 'Schváleno 1/2 · čeká na Radka',
      done: 1,
      total: 2,
    });
  });
  it('speaks to the viewer when they are the one awaited', () => {
    expect(progressLine('in_review', approval({ approvedNames: ['Honza'], waitingFor: ['Radek'] }), 'Radek')?.text).toBe('Schváleno 1/2 · čeká na tebe');
  });
  it('reports a complete approval and nothing for other states', () => {
    expect(progressLine('approved', approval({ state: 'approved', approvedNames: ['Honza', 'Radek'], waitingFor: [] }), 'Admin')).toEqual({
      text: 'Schváleno oběma',
      done: 2,
      total: 2,
    });
    expect(progressLine('draft', approval(), 'Admin')).toBeNull();
    expect(progressLine('returned', approval({ state: 'returned' }), 'Admin')).toBeNull();
  });
});

describe('failingChecks', () => {
  it('lists the labels of rules that failed', () => {
    const checks = [
      { code: 'A', label: 'Hook', severity: 'reject' as const, status: 'fail' as const, detail: '' },
      { code: 'B', label: 'Délka', severity: 'reject' as const, status: 'pass' as const, detail: '' },
      { code: 'C', label: 'Hashtagy', severity: 'warn' as const, status: 'fail' as const, detail: '' },
      { code: 'D', label: 'GDPR', severity: 'reject' as const, status: 'manual_pending' as const, detail: '' },
    ];
    expect(failingChecks(checks)).toEqual(['Hook', 'Hashtagy']);
  });
});
