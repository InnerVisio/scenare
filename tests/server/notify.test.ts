import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as s from '@/db/schema';
import { newId } from '@/domain/ids';
import { authSecret, signSession, verifySession } from '@/server/auth/jwt';
import { signDeepLink, verifyDeepLink } from '@/server/auth/token';
import { sendDailyIfDue } from '@/server/notify/daily';
import { sendDigests } from '@/server/notify/digest';
import { runTick } from '@/server/notify/tick';
import { setupWorld, type World } from './helpers';

const SECRET = 'test-secret-test-secret-test-secret-1234';
const T0 = new Date('2026-11-02T09:00:00Z');
const at = (base: Date, minutes: number) => new Date(base.getTime() + minutes * 60_000);

let w: World;
let outbox: string;
let savedEnv: Record<string, string | undefined>;

interface Sent {
  to: string;
  subject: string;
  text: string;
  html: string;
}
function sent(): Sent[] {
  return readdirSync(outbox)
    .sort()
    .map((f) => JSON.parse(readFileSync(path.join(outbox, f), 'utf8')) as Sent);
}

beforeAll(async () => {
  savedEnv = { RESEND_API_KEY: process.env.RESEND_API_KEY, MAIL_OUTBOX_DIR: process.env.MAIL_OUTBOX_DIR, APP_URL: process.env.APP_URL };
  w = await setupWorld();
});

afterAll(() => {
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

beforeEach(async () => {
  delete process.env.RESEND_API_KEY;
  process.env.APP_URL = 'https://scenare.test';
  outbox = mkdtempSync(path.join(tmpdir(), 'outbox-'));
  process.env.MAIL_OUTBOX_DIR = outbox;
  await w.db.delete(s.notifications);
  await w.db.delete(s.jobRuns);
  await w.db.update(s.users).set({ notifyPrefs: { email: true } });
});

afterEach(() => rmSync(outbox, { recursive: true, force: true }));

/** One activity row plus the notification for `userId`. */
async function notify(userId: string, createdAt: Date, opts: { code?: string; action?: string; readAt?: Date } = {}) {
  const [video] = await w.db
    .select({ id: s.videos.id })
    .from(s.videos)
    .where(eq(s.videos.code, opts.code ?? 'V036'));
  const activityId = newId();
  await w.db.insert(s.activityLog).values({
    id: activityId,
    actorId: null,
    videoId: video.id,
    entity: 'video',
    entityId: video.id,
    action: opts.action ?? 'video.meta_updated',
    createdAt,
  });
  const id = newId();
  await w.db.insert(s.notifications).values({ id, userId, activityId, createdAt, readAt: opts.readAt ?? null });
  return id;
}

describe('sendDigests', () => {
  it('waits 10 minutes, batches into one mail and waits 60 minutes after the previous digest', async () => {
    await notify(w.admin.id, T0);
    expect(await sendDigests(w.db, at(T0, 5))).toBe(0);
    expect(await sendDigests(w.db, at(T0, 10))).toBe(1);
    expect(sent()).toHaveLength(1);
    expect(sent()[0].to).toBe('admin@gta.local');
    expect(sent()[0].subject).toBe('GTA Scénáře: 1 novinka');

    await notify(w.admin.id, at(T0, 20));
    await notify(w.admin.id, at(T0, 30));
    expect(await sendDigests(w.db, at(T0, 45))).toBe(0);
    expect(await sendDigests(w.db, at(T0, 69))).toBe(0);
    expect(await sendDigests(w.db, at(T0, 70))).toBe(1);
    expect(sent()).toHaveLength(2);
    expect(sent()[1].subject).toBe('GTA Scénáře: 2 novinky');
    expect(await sendDigests(w.db, at(T0, 200))).toBe(0);
  });

  it('every link in the mail logs in and leads to the script', async () => {
    await notify(w.admin.id, T0);
    await sendDigests(w.db, at(T0, 15));
    const links = [...sent()[0].text.matchAll(/https:\/\/scenare\.test\/auth\/odkaz\?t=([\w.-]+)/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThanOrEqual(1);
    const verified = await Promise.all(links.map((t) => verifyDeepLink(t, authSecret(), at(T0, 20))));
    expect(verified.map((v) => v?.userId)).toEqual(links.map(() => w.admin.id));
    expect(verified.some((v) => v?.path === '/scenare/V036')).toBe(true);
  });

  it('skips read notifications and never sends them later', async () => {
    const id = await notify(w.admin.id, T0, { readAt: at(T0, 2) });
    expect(await sendDigests(w.db, at(T0, 30))).toBe(0);
    expect(sent()).toHaveLength(0);
    const [row] = await w.db.select().from(s.notifications).where(eq(s.notifications.id, id));
    expect(row.emailedAt).not.toBeNull();
    expect(await sendDigests(w.db, at(T0, 300))).toBe(0);
  });

  it('sends nothing to users who switched e-mails off', async () => {
    await w.db.update(s.users).set({ notifyPrefs: { email: false } }).where(eq(s.users.id, w.admin.id));
    await notify(w.admin.id, T0);
    expect(await sendDigests(w.db, at(T0, 30))).toBe(0);
    expect(sent()).toHaveLength(0);
  });

  it('tells leadership how many scripts wait and points the button to /kontrola', async () => {
    await notify(w.honza.id, T0, { action: 'version.submitted', code: 'V036' });
    await notify(w.honza.id, at(T0, 1), { action: 'version.submitted', code: 'V031' });
    expect(await sendDigests(w.db, at(T0, 15))).toBe(1);
    const [mail] = sent();
    expect(mail.subject).toBe('GTA Scénáře: 2 scénáře čekají na tvou kontrolu');
    const tokens = [...mail.html.matchAll(/auth\/odkaz\?t=([\w.-]+)/g)].map((m) => m[1]);
    const paths = (await Promise.all(tokens.map((t) => verifyDeepLink(t, authSecret(), at(T0, 20))))).map((v) => v?.path);
    expect(paths).toContain('/kontrola');
  });
});

describe('sendDailyIfDue', () => {
  it('runs once per Prague day and not before 8:00', async () => {
    const day = new Date('2026-11-04T07:00:00Z'); // 8:00 in Prague (CET)
    expect((await sendDailyIfDue(w.db, at(day, -1))).sent).toBe(0);
    expect(await w.db.select().from(s.jobRuns)).toHaveLength(0);

    const first = await sendDailyIfDue(w.db, day);
    expect(first.sent).toBeGreaterThan(0);
    const [run] = await w.db.select().from(s.jobRuns).where(eq(s.jobRuns.key, 'daily'));
    expect(run.ranOn).toBe('2026-11-04');
    const count = sent().length;

    expect((await sendDailyIfDue(w.db, at(day, 120))).sent).toBe(0);
    expect(sent()).toHaveLength(count);

    expect((await sendDailyIfDue(w.db, at(day, 24 * 60))).sent).toBeGreaterThan(0);
  });

  it('lists scripts waiting for leadership with their codes', async () => {
    await sendDailyIfDue(w.db, new Date('2026-11-04T07:00:00Z'));
    const honza = sent().find((m) => m.to === 'honza@gta.local');
    expect(honza?.subject).toMatch(/^GTA Scénáře: /);
    expect(honza?.text).toMatch(/čeká na tvou kontrolu|čekají na tvou kontrolu/);
  });

  it('adds the T-3 line on 2026-11-10 and the T-1 line on 2026-11-12, nothing in between', async () => {
    const t3 = await sendDailyIfDue(w.db, new Date('2026-11-10T07:00:00Z'));
    expect(t3.reminders).toBeGreaterThanOrEqual(2);
    const honza = sent().find((m) => m.to === 'honza@gta.local');
    expect(honza?.text).toMatch(/Za 3 dny je termín schválení \(13\. 11\.\) — zbývá schválit \d+ /);
    const admin = sent().find((m) => m.to === 'admin@gta.local');
    expect(admin?.text).toMatch(/Za 3 dny je termín schválení \(13\. 11\.\) — chybí ještě \d+ schvál\S+ scénář\S* do plánu\./);

    const none = await sendDailyIfDue(w.db, new Date('2026-11-11T07:00:00Z'));
    expect(none.reminders).toBe(0);

    const before = sent().length;
    const t1 = await sendDailyIfDue(w.db, new Date('2026-11-12T07:00:00Z'));
    expect(t1.reminders).toBeGreaterThanOrEqual(2);
    expect(sent().slice(before).some((m) => m.text.includes('Zítra je termín schválení (13. 11.)'))).toBe(true);
  });

  it('runTick returns the summary of both jobs', async () => {
    await notify(w.admin.id, new Date('2026-11-10T06:00:00Z'));
    const summary = await runTick(w.db, new Date('2026-11-10T07:00:00Z'));
    expect(summary.digests).toBe(1);
    expect(summary.daily).toBeGreaterThan(0);
    expect(summary.reminders).toBeGreaterThanOrEqual(2);
  });
});

describe('deep links', () => {
  it('signs and verifies a link for 7 days', async () => {
    const jwt = await signDeepLink('user-1', '/scenare/V031#komentar-1', SECRET, T0);
    expect(await verifyDeepLink(jwt, SECRET, at(T0, 60 * 24 * 6))).toEqual({ userId: 'user-1', path: '/scenare/V031#komentar-1' });
    expect(await verifyDeepLink(jwt, SECRET, at(T0, 60 * 24 * 7 + 1))).toBeNull();
    expect(await verifyDeepLink(jwt, 'another-secret-another-secret-123456', T0)).toBeNull();
  });

  it('keeps session tokens and deep links apart', async () => {
    const session = await signSession('user-1', SECRET, T0);
    expect(await verifyDeepLink(session, SECRET, T0)).toBeNull();
    const link = await signDeepLink('user-1', '/', SECRET, T0);
    expect(await verifySession(link, SECRET, T0)).toBeNull();
  });

  it('refuses unsafe paths', async () => {
    for (const bad of ['https://evil.example', '//evil.example', 'scenare/V1', '/\\evil', '']) {
      await expect(signDeepLink('user-1', bad, SECRET, T0)).rejects.toThrow();
    }
  });
});
