import { describe, expect, it } from 'vitest';
import { DomainError } from '@/server/errors';
import { loadActor } from '@/server/actor';
import { expectDomainError, setupWorld } from './helpers';

describe('DomainError', () => {
  it('carries code, Czech message and optional details', () => {
    const e = new DomainError('VALIDATION', 'Něco chybí.', ['a', 'b']);
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe('VALIDATION');
    expect(e.message).toBe('Něco chybí.');
    expect(e.details).toEqual(['a', 'b']);
    expect(new DomainError('STALE', 'x').details).toEqual([]);
  });
});

describe('loadActor', () => {
  it('reads id, role and name from users; unknown id is NOT_FOUND', async () => {
    const w = await setupWorld();
    expect(w.honza).toMatchObject({ role: 'leadership', name: 'Honza' });
    expect(w.admin.role).toBe('admin');
    await expectDomainError(loadActor(w.db, 'nope'), 'NOT_FOUND');
  }, 60_000);
});
