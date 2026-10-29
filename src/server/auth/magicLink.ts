import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import * as s from '@/db/schema';
import { sendMail } from '../mail/send';
import { generateToken, hashToken } from './token';

export const LOGIN_LINK_MINUTES = 15;

/** Only same-site relative paths ("/kontrola/V031") are accepted as a return target. */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  return value;
}

function loginMail(link: string) {
  const text = [
    'Ahoj,',
    '',
    'pro přihlášení do GTA Scénáře klikni na tento odkaz:',
    link,
    '',
    `Odkaz platí ${LOGIN_LINK_MINUTES} minut a jde použít jen jednou.`,
    'Pokud ses nepřihlašoval(a), tento e-mail ignoruj.',
  ].join('\n');
  const html = `<p>Ahoj,</p><p>pro přihlášení do GTA Scénáře klikni na tlačítko.</p><p><a href="${link}" style="display:inline-block;padding:14px 28px;border-radius:999px;background:#d9f36a;color:#17151f;font-weight:600;text-decoration:none">Přihlásit se</a></p><p>Odkaz platí ${LOGIN_LINK_MINUTES} minut a jde použít jen jednou. Pokud ses nepřihlašoval(a), tento e-mail ignoruj.</p>`;
  return { text, html };
}

/**
 * Mails a single-use login link. An unknown e-mail is a silent no-op, so the response never reveals
 * who has an account.
 */
export async function requestLoginLink(
  db: Db,
  email: string,
  now: Date,
  opts: { next?: string | null } = {},
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;
  const [user] = await db
    .select({ id: s.users.id, email: s.users.email })
    .from(s.users)
    .where(sql`lower(${s.users.email}) = ${normalized}`);
  if (!user) return;

  const token = generateToken();
  await db.insert(s.loginTokens).values({
    tokenHash: hashToken(token),
    userId: user.id,
    expiresAt: new Date(now.getTime() + LOGIN_LINK_MINUTES * 60_000),
  });

  const base = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  const next = safeNextPath(opts.next);
  const link = `${base}/auth/${token}${next ? `?dalsi=${encodeURIComponent(next)}` : ''}`;
  await sendMail({ to: user.email, subject: 'Přihlášení do GTA Scénáře', ...loginMail(link) });
}

/** Atomically burns a valid token and returns its user; used, expired or unknown tokens give null. */
export async function consumeLoginToken(db: Db, token: string, now: Date): Promise<{ userId: string } | null> {
  if (!token) return null;
  const [row] = await db
    .update(s.loginTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(s.loginTokens.tokenHash, hashToken(token)),
        isNull(s.loginTokens.usedAt),
        gt(s.loginTokens.expiresAt, now),
      ),
    )
    .returning({ userId: s.loginTokens.userId });
  return row ? { userId: row.userId } : null;
}
