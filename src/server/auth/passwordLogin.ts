import { timingSafeEqual } from 'node:crypto';
import { and, eq, gt, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import * as s from '@/db/schema';
import { newId } from '@/domain/ids';

export const PASSWORD_MAX_FAILURES = 5;
export const PASSWORD_WINDOW_MINUTES = 15;
const MIN_PASSWORD_LENGTH = 12;

/** The admin password, or null when the feature is off (unset or shorter than 12 characters). */
export function adminPassword(): string | null {
  const value = process.env.ADMIN_PASSWORD;
  return value && value.length >= MIN_PASSWORD_LENGTH ? value : null;
}

export const passwordLoginEnabled = () => adminPassword() !== null;

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  // Pad to equal length so the comparison time does not depend on where the strings differ.
  const len = Math.max(x.length, y.length, 1);
  const px = Buffer.alloc(len);
  const py = Buffer.alloc(len);
  x.copy(px);
  y.copy(py);
  return timingSafeEqual(px, py) && x.length === y.length;
}

/**
 * Checks e-mail + password for the bootstrap admin. Only an existing user with role admin matches.
 * Returns the user id, or null for any failure (the caller shows one generic message). Failures are
 * throttled per e-mail: 5 per 15 minutes, after which even the right password is refused.
 */
export async function verifyAdminPassword(db: Db, email: string, password: string, now: Date): Promise<string | null> {
  const expected = adminPassword();
  const normalized = email.trim().toLowerCase();
  if (!expected || !normalized) return null;

  const since = new Date(now.getTime() - PASSWORD_WINDOW_MINUTES * 60_000);
  const [{ failures }] = await db
    .select({ failures: sql<number>`count(*)::int` })
    .from(s.loginAttempts)
    .where(and(eq(s.loginAttempts.email, normalized), gt(s.loginAttempts.attemptedAt, since)));
  if (failures >= PASSWORD_MAX_FAILURES) return null;

  const [user] = await db
    .select({ id: s.users.id, role: s.users.role })
    .from(s.users)
    .where(sql`lower(${s.users.email}) = ${normalized}`);
  const passwordOk = safeEqual(password, expected);
  if (user && user.role === 'admin' && passwordOk) return user.id;

  await db.insert(s.loginAttempts).values({ id: newId(), email: normalized, attemptedAt: now });
  return null;
}
