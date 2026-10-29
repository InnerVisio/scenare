import { describe, expect, it } from 'vitest';
import { can, type Action, type Role } from '@/domain/policy/can';

const ACTIONS: Action[] = [
  'script.create',
  'script.edit',
  'script.submit',
  'script.unlock',
  'script.lifecycle',
  'comment.create',
  'comment.suggest',
  'suggestion.decide',
  'comment.address',
  'comment.close',
  'comment.reopen',
  'number.flag',
  'number.confirm',
  'approval.decide',
  'settings.manage',
  'production.update',
];

// Explicit expected matrix. Marketer's owner-bound actions are listed for the
// owner case here; the non-owner case is covered in its own table below.
const T = true;
const F = false;
const EXPECTED: Record<Role, Record<Action, boolean>> = {
  admin: {
    'script.create': T,
    'script.edit': T,
    'script.submit': T,
    'script.unlock': T,
    'script.lifecycle': T,
    'comment.create': T,
    'comment.suggest': T,
    'suggestion.decide': T,
    'comment.address': T,
    'comment.close': F,
    'comment.reopen': F,
    'number.flag': T,
    'number.confirm': F,
    'approval.decide': F,
    'settings.manage': T,
    'production.update': T,
  },
  leadership: {
    'script.create': F,
    'script.edit': F,
    'script.submit': F,
    'script.unlock': F,
    'script.lifecycle': T,
    'comment.create': T,
    'comment.suggest': T,
    'suggestion.decide': F,
    'comment.address': F,
    'comment.close': T,
    'comment.reopen': T,
    'number.flag': T,
    'number.confirm': T,
    'approval.decide': T,
    'settings.manage': F,
    'production.update': F,
  },
  marketer: {
    'script.create': T,
    'script.edit': T, // owner only
    'script.submit': T, // owner only
    'script.unlock': T, // owner only
    'script.lifecycle': F,
    'comment.create': T,
    'comment.suggest': T,
    'suggestion.decide': T, // owner only
    'comment.address': T, // owner only
    'comment.close': F,
    'comment.reopen': F,
    'number.flag': T,
    'number.confirm': F,
    'approval.decide': F,
    'settings.manage': F,
    'production.update': F,
  },
  production: {
    'script.create': F,
    'script.edit': F,
    'script.submit': F,
    'script.unlock': F,
    'script.lifecycle': F,
    'comment.create': F,
    'comment.suggest': F,
    'suggestion.decide': F,
    'comment.address': F,
    'comment.close': F,
    'comment.reopen': F,
    'number.flag': F,
    'number.confirm': F,
    'approval.decide': F,
    'settings.manage': F,
    'production.update': T,
  },
};

const OWNER_BOUND: Action[] = [
  'script.edit',
  'script.submit',
  'script.unlock',
  'suggestion.decide',
  'comment.address',
];

const ROLES = Object.keys(EXPECTED) as Role[];
const user = (role: Role) => ({ id: 'u1', role });

describe('can: role x action matrix', () => {
  it('lists every action for every role', () => {
    for (const role of ROLES) {
      expect(Object.keys(EXPECTED[role]).sort()).toEqual([...ACTIONS].sort());
    }
  });

  const rows = ROLES.flatMap((role) => ACTIONS.map((action) => [role, action] as const));
  it.each(rows)('%s / %s', (role, action) => {
    // The marketer is the owner so owner-bound actions reflect the matrix.
    expect(can(user(role), action, { ownerId: 'u1' })).toBe(EXPECTED[role][action]);
  });
});

describe('can: marketer ownership', () => {
  const marketer = user('marketer');

  it.each(OWNER_BOUND)('%s is allowed on own script', (action) => {
    expect(can(marketer, action, { ownerId: 'u1' })).toBe(true);
  });
  it.each(OWNER_BOUND)('%s is denied on someone else\'s script', (action) => {
    expect(can(marketer, action, { ownerId: 'other' })).toBe(false);
  });
  it.each(OWNER_BOUND)('%s is denied when the owner is null', (action) => {
    expect(can(marketer, action, { ownerId: null })).toBe(false);
  });
  it.each(OWNER_BOUND)('%s is denied without context', (action) => {
    expect(can(marketer, action)).toBe(false);
  });
  it('does not require ownership for non-owner-bound actions', () => {
    expect(can(marketer, 'script.create')).toBe(true);
    expect(can(marketer, 'comment.create', { ownerId: 'other' })).toBe(true);
    expect(can(marketer, 'number.flag')).toBe(true);
  });
});

describe('can: other roles ignore ownership', () => {
  it('admin may edit any script', () => {
    expect(can(user('admin'), 'script.edit', { ownerId: 'other' })).toBe(true);
    expect(can(user('admin'), 'script.edit')).toBe(true);
  });
  it('leadership may not edit even own script', () => {
    expect(can(user('leadership'), 'script.edit', { ownerId: 'u1' })).toBe(false);
  });
});

describe('can: invariants', () => {
  it('admin can never decide approvals or confirm numbers', () => {
    expect(can(user('admin'), 'approval.decide')).toBe(false);
    expect(can(user('admin'), 'number.confirm')).toBe(false);
  });
  it('denies an unknown role', () => {
    expect(can({ id: 'u1', role: 'ghost' as Role }, 'comment.create')).toBe(false);
  });
});
