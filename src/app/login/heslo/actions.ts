'use server';

import { redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import { passwordLoginEnabled, verifyAdminPassword } from '@/server/auth/passwordLogin';
import { createSession } from '@/server/auth/session';

const GENERIC_ERROR = 'Nesprávný e-mail nebo heslo.';

export async function loginWithPassword(_previous: string, formData: FormData): Promise<string> {
  if (!passwordLoginEnabled()) return GENERIC_ERROR;
  const userId = await verifyAdminPassword(
    await getDb(),
    String(formData.get('email') ?? ''),
    String(formData.get('password') ?? ''),
    new Date(),
  );
  if (!userId) return GENERIC_ERROR;
  await createSession(userId);
  redirect('/');
}
