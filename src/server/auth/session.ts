import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { loadActor, type Actor } from '../actor';
import { DomainError } from '../errors';
import { authSecret, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, signSession, verifySession } from './jwt';

/** Sets the httpOnly session cookie (JWT HS256, 30 days). Call from a server action or route handler. */
export async function createSession(userId: string): Promise<void> {
  const now = new Date();
  const jwt = await signSession(userId, authSecret(), now);
  const store = await cookies();
  store.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    sameSite: 'lax',
    secure: (process.env.APP_URL ?? '').startsWith('https:'),
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function readSession(): Promise<{ userId: string } | null> {
  const jwt = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!jwt) return null;
  return verifySession(jwt, authSecret(), new Date());
}

/** The logged-in user, or a redirect to `/login`. */
export async function requireActor(): Promise<Actor> {
  const session = await readSession();
  if (!session) redirect('/login');
  try {
    return await loadActor(await getDb(), session.userId);
  } catch (error) {
    if (error instanceof DomainError && error.code === 'NOT_FOUND') redirect('/login');
    throw error;
  }
}
