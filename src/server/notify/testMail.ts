import { eq } from 'drizzle-orm';
import type { Db } from '@/db/client';
import * as s from '@/db/schema';
import { can } from '@/domain/policy/can';
import type { Actor } from '../actor';
import { DomainError } from '../errors';
import { sendMail } from '../mail/send';
import { deepLinkUrl } from './links';
import { renderMail } from './mailTemplate';

/** Admin diagnostics: a short mail with a login link to `/`, sent to the admin's own address. */
export async function sendTestMail(db: Db, actor: Actor, now: Date): Promise<void> {
  if (!can(actor, 'settings.manage')) throw new DomainError('FORBIDDEN', 'Sem nemáš přístup.');
  const [user] = await db.select({ email: s.users.email }).from(s.users).where(eq(s.users.id, actor.id));
  if (!user) throw new DomainError('NOT_FOUND', 'Uživatel nenalezen.');
  const { html, text } = renderMail({
    heading: 'Testovací e-mail',
    intro: 'Tohle je zkouška odesílání z GTA Scénáře. Pokud ti dorazil, e-maily fungují.',
    cta: { label: 'Otevřít aplikaci', url: await deepLinkUrl(actor.id, '/', now) },
  });
  await sendMail({ to: user.email, subject: 'GTA Scénáře: testovací e-mail', text, html });
}
