import { SignJWT } from 'jose/jwt/sign';
import { jwtVerify } from 'jose/jwt/verify';

/** Edge-safe (jose only): imported by middleware, so it must not touch node:* modules or the database. */

export const SESSION_COOKIE = 'gta_session';
export const SESSION_DAYS = 30;
export const SESSION_MAX_AGE_SECONDS = SESSION_DAYS * 24 * 60 * 60;

const DEV_SECRET = 'dev-only-secret-dev-only-secret-0123456789';
let warnedAboutDevSecret = false;

/** `AUTH_SECRET` is mandatory in production; dev and test fall back to a fixed secret (with one warning). */
export function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET není nastavený. Nastav ho v prostředí aplikace (alespoň 32 znaků).');
  }
  if (!warnedAboutDevSecret && process.env.NODE_ENV !== 'test') {
    warnedAboutDevSecret = true;
    console.warn('AUTH_SECRET není nastavený, používám vývojový klíč. V produkci to není povolené.');
  }
  return DEV_SECRET;
}

const key = (secret: string) => new TextEncoder().encode(secret);

export async function signSession(userId: string, secret: string, now: Date): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + SESSION_MAX_AGE_SECONDS)
    .sign(key(secret));
}

/** The user id of a valid, unexpired session JWT, otherwise null (never throws). */
export async function verifySession(jwt: string, secret: string, now: Date): Promise<{ userId: string } | null> {
  if (!jwt) return null;
  try {
    const { payload } = await jwtVerify(jwt, key(secret), { algorithms: ['HS256'], currentDate: now });
    return typeof payload.sub === 'string' && payload.sub ? { userId: payload.sub } : null;
  } catch {
    return null;
  }
}
