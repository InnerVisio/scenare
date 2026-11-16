'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { appUrl } from '@/server/appUrl';
import { isSameOriginRequest } from '@/server/auth/origin';
import { createSession } from '@/server/auth/session';
import { resolveTeamLinkUser } from '@/server/settings';

/** Signs in as a leadership user picked on the shared team page. Re-validates everything server-side. */
export async function signInViaTeamLink(formData: FormData): Promise<void> {
  const secret = String(formData.get('secret') ?? '');
  const userId = String(formData.get('userId') ?? '');
  const h = await headers();
  const host = h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  if (!isSameOriginRequest(h.get('origin'), `${proto}://${host}/`, appUrl() ?? undefined)) redirect('/login?chyba=odkaz');

  const db = await getDb();
  // Re-validates the secret; only leadership users are allowed, an admin (or unknown) id is refused.
  const id = await resolveTeamLinkUser(db, secret, userId);
  if (!id) redirect(`/tym/${encodeURIComponent(secret)}`);
  await createSession(id);
  redirect('/');
}
