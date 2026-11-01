import { createHash, randomBytes } from 'node:crypto';
import { SignJWT } from 'jose/jwt/sign';
import { jwtVerify } from 'jose/jwt/verify';
import { safeNextPath } from './magicLink';

export { signSession, verifySession } from './jwt';

/** 32 random bytes, base64url (43 characters). */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** sha256 hex; only this hash of a login token is stored. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export const DEEP_LINK_DAYS = 7;
const DEEP_LINK_PURPOSE = 'deeplink';
const keyOf = (secret: string) => new TextEncoder().encode(secret);

/** A 7-day JWT that logs `userId` in and sends them to `path` (a safe relative path); throws on an unsafe path. */
export async function signDeepLink(userId: string, path: string, secret: string, now: Date): Promise<string> {
  const safe = safeNextPath(path);
  if (!safe || safe !== path) throw new Error('Nebezpečná cílová cesta odkazu.');
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({ purpose: DEEP_LINK_PURPOSE, path: safe })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + DEEP_LINK_DAYS * 24 * 60 * 60)
    .sign(keyOf(secret));
}

/** User and path of a valid deep link, otherwise null (session JWTs and tampered or expired tokens included). */
export async function verifyDeepLink(jwt: string, secret: string, now: Date): Promise<{ userId: string; path: string } | null> {
  if (!jwt) return null;
  try {
    const { payload } = await jwtVerify(jwt, keyOf(secret), { algorithms: ['HS256'], currentDate: now });
    if (payload.purpose !== DEEP_LINK_PURPOSE || typeof payload.sub !== 'string' || !payload.sub) return null;
    const path = typeof payload.path === 'string' ? safeNextPath(payload.path) : null;
    return path ? { userId: payload.sub, path } : null;
  } catch {
    return null;
  }
}

export const CREW_LINK_DAYS = 14;
const CREW_LINK_PURPOSE = 'crew';

/** A 14-day read-only JWT for the shooting crew's page of one cycle. Has a purpose, so it is never a session. */
export async function signCrewLink(cycleId: string, secret: string, now: Date): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({ purpose: CREW_LINK_PURPOSE, cycleId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + CREW_LINK_DAYS * 24 * 60 * 60)
    .sign(keyOf(secret));
}

/** Cycle of a valid crew link, otherwise null (other tokens, tampered or expired ones included). */
export async function verifyCrewLink(jwt: string, secret: string, now: Date): Promise<{ cycleId: string } | null> {
  if (!jwt) return null;
  try {
    const { payload } = await jwtVerify(jwt, keyOf(secret), { algorithms: ['HS256'], currentDate: now });
    if (payload.purpose !== CREW_LINK_PURPOSE || typeof payload.cycleId !== 'string' || !payload.cycleId) return null;
    return { cycleId: payload.cycleId };
  } catch {
    return null;
  }
}
