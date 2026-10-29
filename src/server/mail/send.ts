import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * With `RESEND_API_KEY`: sends through the Resend REST API.
 * Otherwise (dev, tests): logs a one-line summary and writes the message to
 * `MAIL_OUTBOX_DIR` (default `.data/outbox`) as JSON.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM ?? 'GTA Scénáře <scenare@example.com>',
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
      }),
    });
    if (!response.ok) {
      throw new Error(`Odeslání e-mailu selhalo (${response.status}): ${(await response.text()).slice(0, 200)}`);
    }
    return;
  }

  const dir = path.resolve(process.env.MAIL_OUTBOX_DIR ?? '.data/outbox');
  await mkdir(dir, { recursive: true });
  const createdAt = new Date().toISOString();
  const file = path.join(dir, `${createdAt.replace(/[:.]/g, '-')}-${Math.random().toString(36).slice(2, 8)}.json`);
  await writeFile(file, JSON.stringify({ ...message, createdAt }, null, 2), 'utf8');
  console.log(`[mail] ${message.to}: ${message.subject} → ${file}`);
}
