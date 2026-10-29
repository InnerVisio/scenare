/**
 * Public base URL of the app (links in e-mails, origin check, cookie `secure` flag).
 * `APP_URL` wins; on Vercel it is derived from the system variables; locally it is null.
 */
export function appUrl(env: Record<string, string | undefined> = process.env): string | null {
  const explicit = env.APP_URL?.trim();
  if (explicit) return explicit;
  const host = (value: string | undefined) => value?.trim() || undefined;
  const picked =
    env.VERCEL_ENV === 'preview'
      ? (host(env.VERCEL_BRANCH_URL) ?? host(env.VERCEL_URL))
      : env.VERCEL_ENV === 'production'
        ? (host(env.VERCEL_PROJECT_PRODUCTION_URL) ?? host(env.VERCEL_URL))
        : host(env.VERCEL_URL);
  return picked ? `https://${picked}` : null;
}
