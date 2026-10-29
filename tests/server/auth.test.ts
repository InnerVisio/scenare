import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as s from '@/db/schema';
import { authSecret } from '@/server/auth/jwt';
import { isSameOriginRequest } from '@/server/auth/origin';
import { consumeLoginToken, requestLoginLink, safeNextPath } from '@/server/auth/magicLink';
import { generateToken, hashToken, signSession, verifySession } from '@/server/auth/token';
import { minutesLater, NOW, setupWorld, type World } from './helpers';

const SECRET = 'test-secret-test-secret-test-secret-1234';

describe('token primitives', () => {
  it('generates 32 random bytes as base64url and hashes with sha256 hex', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
    expect(hashToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('signs and verifies a session', async () => {
    const jwt = await signSession('user-1', SECRET, NOW);
    expect(await verifySession(jwt, SECRET, minutesLater(60))).toEqual({ userId: 'user-1' });
  });

  it('rejects a tampered JWT and a wrong secret', async () => {
    const jwt = await signSession('user-1', SECRET, NOW);
    const [h, p, sig] = jwt.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ sub: 'user-2', iat: 1, exp: 9_999_999_999 })).toString('base64url');
    expect(await verifySession(`${h}.${forgedPayload}.${sig}`, SECRET, NOW)).toBeNull();
    expect(await verifySession(jwt, 'another-secret-another-secret-123456', NOW)).toBeNull();
    expect(await verifySession(`${h}.${p}`, SECRET, NOW)).toBeNull();
    expect(await verifySession('', SECRET, NOW)).toBeNull();
  });

  it('rejects an expired JWT (30 days)', async () => {
    const jwt = await signSession('user-1', SECRET, NOW);
    const day = 24 * 60;
    expect(await verifySession(jwt, SECRET, minutesLater(29 * day))).toEqual({ userId: 'user-1' });
    expect(await verifySession(jwt, SECRET, minutesLater(31 * day))).toBeNull();
  });
});

describe('safeNextPath', () => {
  it.each([
    '/\t/evil.com',
    '/\n/evil.com',
    '/\r/evil.com',
    '/\\evil.com',
    '/%5Cevil.com',
    '//evil.com',
    '/%09/evil.com',
    '/%2f/evil.com',
    '/ /evil.com',
    '/\u00a0/evil.com',
    '/\u0000x',
    '/\u007fx',
    'https://evil.com',
    'http://localhost:3000/x',
    'evil.com',
    '',
    '/%zz',
    '/.//evil.com',
    '/a/..//evil.com',
    '/%2e//evil.com',
  ])('rejects %j', (value) => {
    expect(safeNextPath(value)).toBeNull();
  });

  it('accepts and normalises same-site paths', () => {
    expect(safeNextPath('/kontrola/V031?x=1#k')).toBe('/kontrola/V031?x=1#k');
    expect(safeNextPath('/')).toBe('/');
    expect(safeNextPath('/a/../b')).toBe('/b');
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
  });
});

describe('isSameOriginRequest', () => {
  const url = 'http://localhost:3000/auth/abc';

  it('allows a missing Origin header and the own origin', () => {
    expect(isSameOriginRequest(null, url)).toBe(true);
    expect(isSameOriginRequest('http://localhost:3000', url)).toBe(true);
  });

  it('rejects another origin, "null" and garbage', () => {
    expect(isSameOriginRequest('https://evil.example', url)).toBe(false);
    expect(isSameOriginRequest('http://localhost:3001', url)).toBe(false);
    expect(isSameOriginRequest('https://localhost:3000', url)).toBe(false);
    expect(isSameOriginRequest('null', url)).toBe(false);
    expect(isSameOriginRequest('not a url', url)).toBe(false);
    expect(isSameOriginRequest('', url)).toBe(false);
  });

  it('accepts the APP_URL origin behind a proxy and still rejects strangers', () => {
    const internal = 'http://10.0.0.5:3000/auth/abc';
    expect(isSameOriginRequest('https://scenare.test', internal, 'https://scenare.test/')).toBe(true);
    expect(isSameOriginRequest('https://evil.example', internal, 'https://scenare.test')).toBe(false);
  });
});

describe('authSecret', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('requires at least 32 characters in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AUTH_SECRET', '');
    expect(() => authSecret()).toThrow(/AUTH_SECRET/);
    vi.stubEnv('AUTH_SECRET', 'short-secret');
    expect(() => authSecret()).toThrow(/AUTH_SECRET/);
    vi.stubEnv('AUTH_SECRET', 'x'.repeat(32));
    expect(authSecret()).toBe('x'.repeat(32));
  });

  it('falls back to a dev secret outside production', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('AUTH_SECRET', '');
    expect(authSecret().length).toBeGreaterThanOrEqual(32);
  });
});

describe('magic link', () => {
  let w: World;
  let outbox: string;

  beforeAll(async () => {
    w = await setupWorld();
  });

  beforeEach(() => {
    outbox = mkdtempSync(path.join(tmpdir(), 'scenare-outbox-'));
    process.env.MAIL_OUTBOX_DIR = outbox;
    process.env.APP_URL = 'https://scenare.test';
    delete process.env.RESEND_API_KEY;
  });

  afterEach(async () => {
    delete process.env.MAIL_OUTBOX_DIR;
    await w.db.delete(s.loginTokens);
    rmSync(outbox, { recursive: true, force: true });
  });

  const mails = () =>
    readdirSync(outbox).map((f) => JSON.parse(readFileSync(path.join(outbox, f), 'utf8')) as Record<string, string>);
  const tokenFrom = (text: string) => /\/auth\/([A-Za-z0-9_-]+)/.exec(text)?.[1] ?? '';

  it('stores only the hash, expires in 15 minutes and mails a Czech link', async () => {
    await requestLoginLink(w.db, 'honza@gta.local', NOW);

    const [mail] = mails();
    expect(mails()).toHaveLength(1);
    expect(mail.to).toBe('honza@gta.local');
    expect(mail.subject).toBe('Přihlášení do GTA Scénáře');
    expect(mail.text).toContain('15 minut');
    const token = tokenFrom(mail.text);
    expect(mail.text).toContain(`https://scenare.test/auth/${token}`);

    const rows = await w.db.select().from(s.loginTokens);
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(hashToken(token));
    expect(rows[0].tokenHash).not.toContain(token);
    expect(rows[0].expiresAt.getTime()).toBe(minutesLater(15).getTime());
    expect(rows[0].usedAt).toBeNull();
  });

  it('is single use', async () => {
    await requestLoginLink(w.db, 'honza@gta.local', NOW);
    const token = tokenFrom(mails()[0].text);

    const first = await consumeLoginToken(w.db, token, minutesLater(1));
    expect(first).toEqual({ userId: w.honza.id });
    expect(await consumeLoginToken(w.db, token, minutesLater(2))).toBeNull();
    const [row] = await w.db.select().from(s.loginTokens).where(eq(s.loginTokens.tokenHash, hashToken(token)));
    expect(row.usedAt?.getTime()).toBe(minutesLater(1).getTime());
  });

  it('expires after 15 minutes', async () => {
    await requestLoginLink(w.db, 'radek@gta.local', NOW);
    const token = tokenFrom(mails()[0].text);

    expect(await consumeLoginToken(w.db, token, minutesLater(16))).toBeNull();
    // An expired token stays unusable and is not marked as used.
    expect(await consumeLoginToken(w.db, token, minutesLater(1))).toEqual({ userId: w.radek.id });
  });

  it('is not valid exactly at the expiry instant', async () => {
    await requestLoginLink(w.db, 'radek@gta.local', NOW);
    const token = tokenFrom(mails()[0].text);
    expect(await consumeLoginToken(w.db, token, minutesLater(15))).toBeNull();
  });

  it('silently ignores an unknown e-mail (no row, no mail)', async () => {
    await expect(requestLoginLink(w.db, 'nobody@example.com', NOW)).resolves.toBeUndefined();
    expect(await w.db.select().from(s.loginTokens)).toHaveLength(0);
    expect(mails()).toHaveLength(0);
  });

  it('matches e-mails case-insensitively and ignores surrounding spaces', async () => {
    await requestLoginLink(w.db, '  Honza@GTA.local ', NOW);
    expect(mails()).toHaveLength(1);
  });

  it('throttles: no second token or mail within 60 seconds, allowed again after', async () => {
    await requestLoginLink(w.db, 'honza@gta.local', NOW);
    await expect(requestLoginLink(w.db, 'honza@gta.local', new Date(NOW.getTime() + 30_000))).resolves.toBeUndefined();
    expect(mails()).toHaveLength(1);
    expect(await w.db.select().from(s.loginTokens)).toHaveLength(1);

    // Another user is not affected.
    await requestLoginLink(w.db, 'radek@gta.local', new Date(NOW.getTime() + 30_000));
    expect(mails()).toHaveLength(2);

    await requestLoginLink(w.db, 'honza@gta.local', new Date(NOW.getTime() + 61_000));
    expect(mails()).toHaveLength(3);
    expect(await w.db.select().from(s.loginTokens)).toHaveLength(3);
  });

  it('rejects unknown and empty tokens', async () => {
    expect(await consumeLoginToken(w.db, 'nonsense', NOW)).toBeNull();
    expect(await consumeLoginToken(w.db, '', NOW)).toBeNull();
  });

  it('appends a safe relative return path to the link', async () => {
    await requestLoginLink(w.db, 'honza@gta.local', NOW, { next: '/kontrola/V031' });
    expect(mails()[0].text).toContain('?dalsi=%2Fkontrola%2FV031');
    await w.db.delete(s.loginTokens);
    rmSync(outbox, { recursive: true, force: true });
    outbox = mkdtempSync(path.join(tmpdir(), 'scenare-outbox-'));
    process.env.MAIL_OUTBOX_DIR = outbox;
    await requestLoginLink(w.db, 'honza@gta.local', minutesLater(5), { next: 'https://evil.example' });
    expect(mails()[0].text).not.toContain('dalsi');
  });
});
