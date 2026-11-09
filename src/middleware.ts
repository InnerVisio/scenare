import { NextResponse, type NextRequest } from 'next/server';
import { authSecret, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, shouldRefreshSession, signSession, verifySessionDetailed } from '@/server/auth/jwt';

const PUBLIC_PATHS = ['/login', '/login/heslo', '/dev-login'];

function isPublic(pathname: string): boolean {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    pathname === '/auth' ||
    pathname.startsWith('/auth/') ||
    // The shooting crew's read-only page; the signed link in the path is the credential.
    pathname.startsWith('/stab/') ||
    // The scheduler authenticates with its own bearer secret.
    pathname.startsWith('/api/cron/')
  );
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const jwt = request.cookies.get(SESSION_COOKIE)?.value;
  const now = new Date();
  const session = jwt ? await verifySessionDetailed(jwt, authSecret(), now) : null;
  if (session) {
    const response = NextResponse.next();
    if (shouldRefreshSession(session.issuedAt, now)) {
      response.cookies.set(SESSION_COOKIE, await signSession(session.userId, authSecret(), now), {
        httpOnly: true,
        sameSite: 'lax',
        secure: request.nextUrl.protocol === 'https:',
        path: '/',
        maxAge: SESSION_MAX_AGE_SECONDS,
      });
    }
    return response;
  }

  const login = request.nextUrl.clone();
  login.pathname = '/login';
  login.search = pathname === '/' ? '' : `?dalsi=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff2?)$).*)'],
};
