import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { toActionResult } from '@/server/actionResult';
import { DomainError } from '@/server/errors';

describe('toActionResult', () => {
  it('wraps a result object', async () => {
    expect(await toActionResult(async () => ({ id: 'x' }))).toEqual({ ok: true, id: 'x' });
  });

  it('accepts use cases that return nothing', async () => {
    expect(await toActionResult(async () => undefined)).toEqual({ ok: true });
  });

  it('maps DomainError to code, Czech message and details', async () => {
    const result = await toActionResult(async () => {
      throw new DomainError('VALIDATION', 'Schválit i tak?', ['1 nevyřešený komentář']);
    });
    expect(result).toEqual({ ok: false, code: 'VALIDATION', message: 'Schválit i tak?', details: ['1 nevyřešený komentář'] });
  });

  it('defaults details to an empty list', async () => {
    const result = await toActionResult(async () => {
      throw new DomainError('FORBIDDEN', 'K této akci nemáš oprávnění.');
    });
    expect(result).toEqual({ ok: false, code: 'FORBIDDEN', message: 'K této akci nemáš oprávnění.', details: [] });
  });

  it('maps invalid input (zod) to VALIDATION', async () => {
    const result = await toActionResult(async () => z.object({ a: z.string() }).parse({ a: 1 }));
    expect(result).toMatchObject({ ok: false, code: 'VALIDATION', message: 'Neplatný požadavek.' });
  });

  it('rethrows unexpected errors', async () => {
    await expect(
      toActionResult(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });
});
