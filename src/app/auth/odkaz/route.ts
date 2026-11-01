import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/db/client';
import { appUrl } from '@/server/appUrl';
import { loadActor } from '@/server/actor';
import { authSecret } from '@/server/auth/jwt';
import { createSession } from '@/server/auth/session';
import { verifyDeepLink } from '@/server/auth/token';

export const dynamic = 'force-dynamic';

function redirectTo(path: string, request: NextRequest) {
  const response = NextResponse.redirect(new URL(path, appUrl() || request.url), 303);
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

/** E-mail deep link: a valid `?t=` logs the user in and opens the target path. */
export async function GET(request: NextRequest) {
  const link = await verifyDeepLink(request.nextUrl.searchParams.get('t') ?? '', authSecret(), new Date());
  if (!link) return redirectTo('/login?chyba=odkaz', request);
  try {
    await loadActor(await getDb(), link.userId);
  } catch {
    return redirectTo('/login?chyba=odkaz', request);
  }
  await createSession(link.userId);
  return redirectTo(link.path, request);
}
