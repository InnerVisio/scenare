import { and, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import * as s from '@/db/schema';
import { SESSION_MAX_AGE_SECONDS, shouldRefreshSession } from '@/server/auth/jwt';
import { consumeLoginToken, createPersonalLoginLink, PERSONAL_LINK_DAYS } from '@/server/auth/magicLink';
import { passwordLoginEnabled, PASSWORD_MAX_FAILURES, verifyAdminPassword } from '@/server/auth/passwordLogin';
import { describeActivity } from '@/server/activityText';
import { expectDomainError, minutesLater, NOW, setupWorld, type World } from './helpers';

let w: World;
beforeAll(async () => {
  w = await setupWorld();
});

const ADMIN_EMAIL = 'admin@gta.local';
const HONZA_EMAIL = 'honza@gta.local';
const tokenOf = (url: string) => url.split('/auth/')[1]!;
const day = 24 * 60;

describe('personal login links', () => {
  it('only an admin can create one', async () => {
    await expectDomainError(createPersonalLoginLink(w.db, w.honza, w.radek.id, NOW), 'FORBIDDEN');
  });

  it('is valid for 7 days, single use, and logged without notifications', async () => {
    const { url } = await createPersonalLoginLink(w.db, w.admin, w.radek.id, NOW);
    expect(PERSONAL_LINK_DAYS).toBe(7);
    expect(await consumeLoginToken(w.db, tokenOf(url), minutesLater(8 * day))).toBeNull();
    expect(await consumeLoginToken(w.db, tokenOf(url), minutesLater(6 * day))).toEqual({ userId: w.radek.id });
    expect(await consumeLoginToken(w.db, tokenOf(url), minutesLater(6 * day))).toBeNull();
    const [log] = await w.db.select().from(s.activityLog).where(eq(s.activityLog.action, 'user.login_link_created'));
    expect(log?.after).toEqual({ targetName: w.radek.name });
    expect(await w.db.select().from(s.notifications).where(eq(s.notifications.activityId, log!.id))).toHaveLength(0);
    expect(describeActivity({ ...log!, videoCode: null } as never, new Map([[w.admin.id, 'Admin']])).text).toMatch(/^Admin vytvořil přihlašovací odkaz pro /);
  });

  it('a new link invalidates the older unused one', async () => {
    const first = await createPersonalLoginLink(w.db, w.admin, w.honza.id, NOW);
    const second = await createPersonalLoginLink(w.db, w.admin, w.honza.id, minutesLater(5));
    expect(await consumeLoginToken(w.db, tokenOf(first.url), minutesLater(10))).toBeNull();
    expect(await consumeLoginToken(w.db, tokenOf(second.url), minutesLater(10))).toEqual({ userId: w.honza.id });
  });
});

describe('admin password login', () => {
  const PASSWORD = 'correct-horse-battery';
  beforeAll(() => {
    process.env.ADMIN_PASSWORD = PASSWORD;
  });

  it('is off for a short password', () => {
    process.env.ADMIN_PASSWORD = 'short';
    expect(passwordLoginEnabled()).toBe(false);
    process.env.ADMIN_PASSWORD = PASSWORD;
    expect(passwordLoginEnabled()).toBe(true);
  });

  it('accepts the admin and rejects wrong password, unknown e-mail and non-admin roles', async () => {
    expect(await verifyAdminPassword(w.db, ADMIN_EMAIL, 'wrong-password-123', NOW)).toBeNull();
    expect(await verifyAdminPassword(w.db, 'nobody@gta.local', PASSWORD, NOW)).toBeNull();
    expect(await verifyAdminPassword(w.db, HONZA_EMAIL, PASSWORD, NOW)).toBeNull();
    expect(await verifyAdminPassword(w.db, ` ${ADMIN_EMAIL.toUpperCase()} `, PASSWORD, minutesLater(60))).toBe(w.admin.id);
  });

  it('locks an e-mail after 5 failures in 15 minutes, then recovers', async () => {
    const email = ADMIN_EMAIL;
    const start = minutesLater(3 * day);
    for (let i = 0; i < PASSWORD_MAX_FAILURES; i++) {
      expect(await verifyAdminPassword(w.db, email, 'wrong-password-123', start)).toBeNull();
    }
    expect(await verifyAdminPassword(w.db, email, PASSWORD, start)).toBeNull();
    const later = new Date(start.getTime() + 16 * 60_000);
    expect(await verifyAdminPassword(w.db, email, PASSWORD, later)).toBe(w.admin.id);
    const rows = await w.db.select().from(s.loginAttempts).where(and(eq(s.loginAttempts.email, email.toLowerCase())));
    expect(rows.length).toBeGreaterThanOrEqual(PASSWORD_MAX_FAILURES);
  });
});

describe('sliding session', () => {
  const at = (days: number) => new Date(NOW.getTime() + days * 86_400_000);
  const iat = Math.floor(NOW.getTime() / 1000);
  it('refreshes only when older than 7 days', () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(90 * 86_400);
    expect(shouldRefreshSession(iat, at(6))).toBe(false);
    expect(shouldRefreshSession(iat, at(8))).toBe(true);
    expect(shouldRefreshSession(undefined, at(8))).toBe(false);
  });
});
