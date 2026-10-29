import { createHash, randomBytes } from 'node:crypto';

export { signSession, verifySession } from './jwt';

/** 32 random bytes, base64url (43 characters). */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** sha256 hex; only this hash of a login token is stored. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
