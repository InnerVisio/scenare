import { and, eq, inArray, isNotNull, isNull, max, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import * as s from '@/db/schema';
import type { Role } from '@/domain/policy/can';
import { describeActivity } from '../activityText';
import { sendMail } from '../mail/send';
import { deepLinkUrl } from './links';
import { plural, renderMail, type MailItem } from './mailTemplate';

export const DIGEST_SETTLE_MINUTES = 10;
export const DIGEST_MIN_GAP_MINUTES = 60;
const MAX_ITEMS = 15;
const MINUTE = 60_000;

/**
 * E-mail digests: one mail per user listing every unread notification that has not been mailed yet.
 * Waits 10 minutes after the oldest one and at least 60 minutes after the user's previous digest.
 * Always 3 selects and at most 2 updates, however many notifications there are. Returns the mails sent.
 */
export async function sendDigests(db: Db, now: Date): Promise<number> {
  const [pending, lastDigests, names] = await Promise.all([
    db
      .select({
        id: s.notifications.id,
        userId: s.notifications.userId,
        createdAt: s.notifications.createdAt,
        readAt: s.notifications.readAt,
        action: s.activityLog.action,
        actorId: s.activityLog.actorId,
        entityId: s.activityLog.entityId,
        after: s.activityLog.after,
        videoCode: s.videos.code,
        email: s.users.email,
        role: s.users.role,
        notifyPrefs: s.users.notifyPrefs,
      })
      .from(s.notifications)
      .innerJoin(s.activityLog, eq(s.activityLog.id, s.notifications.activityId))
      .innerJoin(s.users, eq(s.users.id, s.notifications.userId))
      .leftJoin(s.videos, eq(s.videos.id, s.activityLog.videoId))
      .where(isNull(s.notifications.emailedAt))
      .orderBy(s.notifications.createdAt, s.notifications.id),
    db
      .select({ userId: s.notifications.userId, last: max(s.notifications.emailedAt) })
      .from(s.notifications)
      .where(isNotNull(s.notifications.emailedAt))
      .groupBy(s.notifications.userId),
    db.select({ id: s.users.id, name: s.users.name }).from(s.users),
  ]);
  if (pending.length === 0) return 0;

  const nameById = new Map(names.map((u) => [u.id, u.name]));
  const lastByUser = new Map(lastDigests.map((d) => [d.userId, d.last]));
  const byUser = new Map<string, typeof pending>();
  for (const row of pending) byUser.set(row.userId, [...(byUser.get(row.userId) ?? []), row]);

  const sentIds: string[] = [];
  const skippedIds: string[] = [];
  let mails = 0;

  for (const [userId, rows] of byUser) {
    const wantsMail = rows[0].notifyPrefs.email !== false;
    const unread = wantsMail ? rows.filter((r) => r.readAt === null) : [];
    if (unread.length === 0) {
      skippedIds.push(...rows.map((r) => r.id));
      continue;
    }
    const settled = now.getTime() - unread[0].createdAt.getTime() >= DIGEST_SETTLE_MINUTES * MINUTE;
    const last = lastByUser.get(userId);
    const spaced = !last || now.getTime() - last.getTime() >= DIGEST_MIN_GAP_MINUTES * MINUTE;
    if (!settled || !spaced) continue;

    const role = rows[0].role as Role;
    const leadership = role === 'leadership';
    const awaiting = leadership ? unread.filter((r) => r.action === 'version.submitted').length : 0;
    const subject =
      awaiting > 0
        ? `GTA Scénáře: ${awaiting} ${plural(awaiting, 'scénář čeká', 'scénáře čekají', 'scénářů čeká')} na tvou kontrolu`
        : `GTA Scénáře: ${unread.length} ${plural(unread.length, 'novinka', 'novinky', 'novinek')}`;

    const shown = unread.slice(0, MAX_ITEMS);
    const items: MailItem[] = await Promise.all(
      shown.map(async (row) => {
        const { text, href } = describeActivity({ ...row, videoCode: row.videoCode, after: row.after }, nameById, { role });
        return { text, url: await deepLinkUrl(userId, href, now) };
      }),
    );
    const rest = unread.length - shown.length;
    const { html, text } = renderMail({
      heading: subject.replace('GTA Scénáře: ', ''),
      intro: rest > 0 ? `Zobrazuji ${shown.length} z ${unread.length}, zbytek najdeš v aplikaci.` : undefined,
      items,
      cta: leadership
        ? { label: 'Otevřít kontrolu', url: await deepLinkUrl(userId, '/kontrola', now) }
        : { label: 'Otevřít aplikaci', url: await deepLinkUrl(userId, '/', now) },
    });
    try {
      await sendMail({ to: rows[0].email, subject, text, html });
    } catch (error) {
      console.error(`[digest] ${rows[0].email}: ${error instanceof Error ? error.message : error}`);
      continue;
    }
    mails += 1;
    sentIds.push(...rows.map((r) => r.id));
  }

  if (sentIds.length > 0) {
    await db.update(s.notifications).set({ emailedAt: now }).where(inArray(s.notifications.id, sentIds));
  }
  if (skippedIds.length > 0) {
    // Never to be mailed: stamped with their own creation time so they do not delay the next real digest.
    await db
      .update(s.notifications)
      .set({ emailedAt: sql`${s.notifications.createdAt}` })
      .where(and(inArray(s.notifications.id, skippedIds), isNull(s.notifications.emailedAt)));
  }
  return mails;
}
