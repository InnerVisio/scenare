import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import * as s from '@/db/schema';
import { daysUntil, formatDayMonth, pragueDay, pragueHour } from '@/domain/format/date';
import { isAwaitingDecision, type ApprovalStatus } from '@/domain/workflow/approval';
import { sendMail } from '../mail/send';
import { getCycleMix } from '../mix';
import { getSettings } from '../settings';
import { deepLinkUrl } from './links';
import { plural, renderMail, type MailItem } from './mailTemplate';

export const DAILY_KEY = 'daily';
export const DAILY_HOUR = 8;
const MAX_ITEMS = 10;
const REMINDER_DAYS = [3, 1];

export interface DailyResult {
  sent: number;
  reminders: number;
}

/** Approval deadline of a cycle: shoot date minus the approval lead time (`YYYY-MM-DD` arithmetic, noon UTC). */
function approvalDeadline(shootDate: string, daysBefore: number): Date {
  const [y, m, d] = shootDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - daysBefore, 12));
}

const scriptCount = (n: number) => `${n} ${plural(n, 'scénář', 'scénáře', 'scénářů')}`;

/**
 * From 8:00 Prague time, once per Prague day: the summary e-mail to leadership and admin (only when
 * there is something to say) with the T-3 / T-1 approval deadline reminder on top.
 */
export async function sendDailyIfDue(db: Db, now: Date): Promise<DailyResult> {
  if (pragueHour(now) < DAILY_HOUR) return { sent: 0, reminders: 0 };
  const today = pragueDay(now);
  // Claim the day first so overlapping ticks cannot both send.
  const claimed = await db
    .insert(s.jobRuns)
    .values({ key: DAILY_KEY, ranOn: today, ranAt: now })
    .onConflictDoUpdate({ target: s.jobRuns.key, set: { ranOn: today, ranAt: now }, setWhere: sql`${s.jobRuns.ranOn} <> ${today}` })
    .returning({ key: s.jobRuns.key });
  if (claimed.length === 0) return { sent: 0, reminders: 0 };

  const [users, settings, cycles, videos, [openComments]] = await Promise.all([
    db
      .select({ id: s.users.id, email: s.users.email, role: s.users.role, notifyPrefs: s.users.notifyPrefs })
      .from(s.users)
      .where(inArray(s.users.role, ['leadership', 'admin'])),
    getSettings(db),
    db.select().from(s.shootingCycles).orderBy(s.shootingCycles.id),
    db
      .select({
        code: s.videos.code,
        title: s.videos.title,
        approvalStatus: s.videos.approvalStatus,
        approvedBy: s.videos.approvedBy,
        cycleId: s.videos.cycleId,
        scriptDueDate: s.videos.scriptDueDate,
      })
      .from(s.videos)
      .where(inArray(s.videos.approvalStatus, ['draft', 'in_review', 'returned', 'final_review'])),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.comments)
      .where(and(eq(s.comments.status, 'open'), isNull(s.comments.parentId))),
  ]);

  // Same rule as the dashboard: the next shoot, otherwise the latest cycle.
  const cycle = cycles.find((c) => c.shootDate !== null && c.shootDate >= today) ?? cycles.at(-1);
  const mix = cycle ? await getCycleMix(db, cycle.id) : null;
  const daysLeft = cycle?.shootDate ? daysUntil(approvalDeadline(cycle.shootDate, settings.approvalDaysBefore), now) : null;
  const deadline = cycle?.shootDate ? approvalDeadline(cycle.shootDate, settings.approvalDaysBefore) : null;
  const reminderPrefix =
    deadline && daysLeft !== null && REMINDER_DAYS.includes(daysLeft)
      ? `${daysLeft === 1 ? 'Zítra' : `Za ${daysLeft} dny`} je termín schválení (${formatDayMonth(deadline)}) — `
      : null;

  const link = (code: string, base: '/kontrola' | '/scenare') => `${base}/${code}`;
  const result: DailyResult = { sent: 0, reminders: 0 };

  for (const user of users) {
    if (user.notifyPrefs.email === false) continue;
    const items: MailItem[] = [];
    const lines: string[] = [];
    let subject = 'GTA Scénáře: denní souhrn';
    let highlight: string | undefined;
    let cta = { label: 'Otevřít aplikaci', path: '/' };

    if (user.role === 'leadership') {
      const waiting = videos.filter((v) => isAwaitingDecision(v.approvalStatus as ApprovalStatus) && !v.approvedBy.includes(user.id));
      if (waiting.length > 0) {
        subject = `GTA Scénáře: ${scriptCount(waiting.length)} ${plural(waiting.length, 'čeká', 'čekají', 'čeká')} na tvou kontrolu`;
        lines.push(`${scriptCount(waiting.length)} ${plural(waiting.length, 'čeká', 'čekají', 'čeká')} na tvou kontrolu:`);
        for (const v of waiting.slice(0, MAX_ITEMS)) {
          items.push({ text: `${v.code} – ${v.title}`, url: await deepLinkUrl(user.id, link(v.code, '/kontrola'), now) });
        }
        cta = { label: 'Otevřít kontrolu', path: '/kontrola' };
      }
      if (reminderPrefix) {
        const remaining = waiting.filter((v) => v.cycleId === cycle?.id).length;
        highlight = reminderPrefix + (remaining > 0 ? `zbývá schválit ${scriptCount(remaining)}.` : 'všechno ke schválení je hotové.');
      }
      if (deadline && daysLeft !== null && daysLeft >= 0 && waiting.length > 0) {
        lines.push(`Termín schválení cyklu ${cycle?.id}: ${formatDayMonth(deadline)} (za ${daysLeft} ${plural(daysLeft, 'den', 'dny', 'dní')}).`);
      }
    } else {
      const returned = videos.filter((v) => v.approvalStatus === 'returned');
      const overdue = videos.filter(
        (v) => v.scriptDueDate !== null && v.scriptDueDate < today && (v.approvalStatus === 'draft' || v.approvalStatus === 'returned'),
      );
      const missing = mix?.categories.rows.filter((r) => r.missing > 0) ?? [];
      if (returned.length > 0) lines.push(`Vrácené k dopracování: ${scriptCount(returned.length)}.`);
      if ((openComments?.n ?? 0) > 0) lines.push(`Otevřené připomínky: ${openComments.n}.`);
      if (overdue.length > 0) lines.push(`Po termínu odevzdání: ${scriptCount(overdue.length)}.`);
      if (missing.length > 0) {
        lines.push(`Do rozdělení cyklu ${cycle?.id} chybí: ${missing.map((r) => `${r.label} ${r.missing}`).join(', ')}.`);
      }
      for (const v of [...returned, ...overdue.filter((o) => !returned.includes(o))].slice(0, MAX_ITEMS)) {
        items.push({ text: `${v.code} – ${v.title}`, url: await deepLinkUrl(user.id, link(v.code, '/scenare'), now) });
      }
      if (reminderPrefix && mix) {
        const missingAll = mix.categories.total.missing;
        highlight =
          reminderPrefix +
          (missingAll > 0
            ? `chybí ještě ${missingAll} ${plural(missingAll, 'schválený scénář', 'schválené scénáře', 'schválených scénářů')} do plánu.`
            : 'plán je splněný.');
      }
    }

    if (highlight) subject = `GTA Scénáře: ${highlight.split(' — ')[0].replace(/^./, (c) => c.toLowerCase())}`;
    if (lines.length === 0 && !highlight) continue;

    const { html, text } = renderMail({
      heading: 'Denní souhrn',
      highlight,
      intro: lines.join('\n'),
      items,
      cta: { label: cta.label, url: await deepLinkUrl(user.id, cta.path, now) },
    });
    try {
      await sendMail({ to: user.email, subject, text, html });
    } catch (error) {
      console.error(`[daily] ${user.email}: ${error instanceof Error ? error.message : error}`);
      continue;
    }
    result.sent += 1;
    if (highlight) result.reminders += 1;
  }
  return result;
}
