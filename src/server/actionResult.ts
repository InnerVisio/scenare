import { ZodError } from 'zod';
import { DomainError, type DomainErrorCode } from './errors';

export type ActionResult<T extends object = Record<never, never>> =
  | ({ ok: true } & T)
  | { ok: false; code: DomainErrorCode; message: string; details: string[] };

/**
 * Runs a use case and turns expected business failures (`DomainError`, invalid input) into a plain
 * result the client can show. Anything else is a bug and is rethrown.
 */
export async function toActionResult<T extends object = Record<never, never>>(
  run: () => Promise<T | void>,
): Promise<ActionResult<T>> {
  try {
    const result = await run();
    return { ok: true, ...(result ?? {}) } as ActionResult<T>;
  } catch (error) {
    if (error instanceof DomainError) {
      return { ok: false, code: error.code, message: error.message, details: error.details };
    }
    if (error instanceof ZodError) {
      return { ok: false, code: 'VALIDATION', message: 'Neplatný požadavek.', details: [] };
    }
    throw error;
  }
}
