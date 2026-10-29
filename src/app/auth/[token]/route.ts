import { NextResponse, type NextRequest } from 'next/server';
import { getDb } from '@/db/client';
import { consumeLoginToken, safeNextPath } from '@/server/auth/magicLink';
import { createSession } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

function redirectTo(path: string, request: NextRequest) {
  return NextResponse.redirect(new URL(path, process.env.APP_URL || request.url));
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await consumeLoginToken(await getDb(), token, new Date());
  if (!result) return redirectTo('/login?chyba=odkaz', request);

  await createSession(result.userId);
  return redirectTo(safeNextPath(request.nextUrl.searchParams.get('dalsi')) ?? '/', request);
}
