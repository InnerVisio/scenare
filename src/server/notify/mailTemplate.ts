const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export interface MailItem {
  text: string;
  url: string;
}

export interface MailContent {
  heading: string;
  /** Highlighted line above the list (deadline reminders). */
  highlight?: string;
  intro?: string;
  items?: MailItem[];
  cta: { label: string; url: string };
}

/** Simple inline-styled HTML (lavender page, white card, dark button) plus the plain-text twin. */
export function renderMail(content: MailContent): { html: string; text: string } {
  const items = content.items ?? [];
  const list = items
    .map(
      (i) =>
        `<li style="margin:0 0 10px"><a href="${escapeHtml(i.url)}" style="color:#17151F;text-decoration:underline">${escapeHtml(i.text)}</a></li>`,
    )
    .join('');
  const html = `<!doctype html>
<html lang="cs"><body style="margin:0;background:#E7E5F3;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#17151F">
<div style="max-width:520px;margin:0 auto;padding:32px 16px">
<div style="background:#ffffff;border-radius:24px;padding:28px 24px">
<h1 style="font-size:22px;line-height:1.25;margin:0 0 16px">${escapeHtml(content.heading)}</h1>
${content.highlight ? `<p style="margin:0 0 16px;padding:12px 14px;border-radius:14px;background:#D9F36A;font-weight:600">${escapeHtml(content.highlight)}</p>` : ''}
${content.intro ? `<p style="margin:0 0 16px;color:#5B5870">${escapeHtml(content.intro)}</p>` : ''}
${list ? `<ul style="margin:0 0 20px;padding-left:20px">${list}</ul>` : ''}
<a href="${escapeHtml(content.cta.url)}" style="display:inline-block;background:#17151F;color:#ffffff;text-decoration:none;font-weight:600;padding:14px 24px;border-radius:999px">${escapeHtml(content.cta.label)}</a>
</div>
<p style="margin:16px 8px 0;font-size:12px;color:#5B5870">Odkazy tě rovnou přihlásí a platí 7 dní. E-maily vypneš v nastavení u svého uživatele.</p>
</div></body></html>`;
  const text = [
    content.heading,
    '',
    ...(content.highlight ? [content.highlight, ''] : []),
    ...(content.intro ? [content.intro, ''] : []),
    ...items.map((i) => `- ${i.text}\n  ${i.url}`),
    ...(items.length ? [''] : []),
    `${content.cta.label}: ${content.cta.url}`,
  ].join('\n');
  return { html, text };
}

/** Czech plural: 1 / 2–4 / 5+ (and 0). */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  return n >= 2 && n <= 4 ? few : many;
}
