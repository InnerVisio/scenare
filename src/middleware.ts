import { NextResponse, type NextRequest } from 'next/server';
import { authSecret, SESSION_COOKIE, verifySession } from '@/server/auth/jwt';

const PUBLIC_PATHS = ['/login', '/dev-login'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname) || pathname === '/auth' || pathname.startsWith('/auth/');
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const jwt = request.cookies.get(SESSION_COOKIE)?.value;
  if (jwt && (await verifySession(jwt, authSecret(), new Date()))) return NextResponse.next();

  const login = request.nextUrl.clone();
  login.pathname = '/login';
  login.search = pathname === '/' ? '' : `?dalsi=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff2?)$).*)'],
};
