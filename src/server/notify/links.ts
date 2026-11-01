import { appUrl } from '../appUrl';
import { authSecret } from '../auth/jwt';
import { signDeepLink } from '../auth/token';

/** Absolute URL that logs `userId` in and opens `path` (e-mail links). */
export async function deepLinkUrl(userId: string, path: string, now: Date): Promise<string> {
  const base = (appUrl() ?? 'http://localhost:3000').replace(/\/+$/, '');
  return `${base}/auth/odkaz?t=${await signDeepLink(userId, path, authSecret(), now)}`;
}
