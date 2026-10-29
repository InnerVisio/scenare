/**
 * CSRF guard for the login POST: a request that carries an `Origin` header must come from this
 * site (the request URL's origin, or the public `APP_URL` origin when behind a proxy).
 * A missing header is allowed (non-browser clients, same-origin navigations in some browsers).
 */
export function isSameOriginRequest(originHeader: string | null, requestUrl: string, appUrl?: string): boolean {
  if (originHeader === null) return true;
  try {
    const origin = new URL(originHeader).origin;
    if (origin === 'null') return false;
    const allowed = [new URL(requestUrl).origin];
    if (appUrl) allowed.push(new URL(appUrl).origin);
    return allowed.includes(origin);
  } catch {
    return false;
  }
}
