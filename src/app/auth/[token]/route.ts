import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/db/client';
import { consumeLoginToken, safeNextPath } from '@/server/auth/magicLink';
import { appUrl } from '@/server/appUrl';
import { isSameOriginRequest } from '@/server/auth/origin';
import { createSession } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ token: string }> };

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

/** 303 so the browser follows a POST with a GET. */
function redirectTo(path: string, request: NextRequest) {
  return NextResponse.redirect(new URL(path, appUrl() || request.url), 303);
}

/**
 * GET only shows a confirmation button. Mail scanners and link previews fetch GET URLs, so the
 * single-use token is burned by the POST below, never by a GET.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { token } = await params;
  const next = safeNextPath(request.nextUrl.searchParams.get('dalsi'));
  const html = `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Přihlášení do GTA Scénáře</title>
<style>
  body { margin: 0; min-width: 360px; background: #e7e5f3; color: #17151f; font-family: system-ui, sans-serif; }
  main { max-width: 28rem; margin: 0 auto; min-height: 100vh; display: flex; flex-direction: column; justify-content: center; gap: 1.5rem; padding: 2.5rem 1rem; box-sizing: border-box; }
  section { background: #fff; border-radius: 28px; padding: 2rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
  h1 { font-size: 30px; line-height: 1.2; font-weight: 600; margin: 0; }
  p { margin: 0; color: #5b5870; }
  button { min-height: 56px; border: 0; border-radius: 999px; background: #d9f36a; color: #17151f; font: inherit; font-weight: 600; font-size: 18px; cursor: pointer; }
</style>
</head>
<body>
<main>
  <section>
    <h1>Přihlášení do GTA Scénáře</h1>
    <p>Klikni na tlačítko a budeš přihlášen(a).</p>
    <form method="post" action="/auth/${encodeURIComponent(token)}">
      ${next ? `<input type="hidden" name="dalsi" value="${escapeHtml(next)}">` : ''}
      <button type="submit" style="width:100%">Přihlásit se</button>
    </form>
  </section>
</main>
</body>
</html>`;
  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex',
    },
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { token } = await params;
  if (!isSameOriginRequest(request.headers.get('origin'), request.url, appUrl() ?? undefined)) {
    return redirectTo('/login?chyba=odkaz', request);
  }
  const form = await request.formData().catch(() => null);
  const next = safeNextPath(String(form?.get('dalsi') ?? ''));

  const result = await consumeLoginToken(await getDb(), token, new Date());
  if (!result) return redirectTo('/login?chyba=odkaz', request);

  await createSession(result.userId);
  return redirectTo(next ?? '/', request);
}
