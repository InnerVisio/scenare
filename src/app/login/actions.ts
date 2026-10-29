'use server';

import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db/client';
import { requestLoginLink, safeNextPath } from '@/server/auth/magicLink';
import { destroySession } from '@/server/auth/session';

export interface LoginState {
  status: 'idle' | 'sent' | 'error';
  message: string;
}

const emailSchema = z.string().trim().pipe(z.email());

export async function requestLink(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = emailSchema.safeParse(formData.get('email'));
  if (!parsed.success) return { status: 'error', message: 'Zadej platný e-mail.' };

  const next = safeNextPath(String(formData.get('dalsi') ?? ''));
  const email = parsed.data;
  // Run after the response is sent so known and unknown addresses answer in the same time.
  after(async () => {
    try {
      await requestLoginLink(await getDb(), email, new Date(), { next });
    } catch (error) {
      // Never reveal whether the address exists: a failure is only logged.
      console.error('Odeslání přihlašovacího odkazu selhalo', error);
    }
  });
  return { status: 'sent', message: 'Zkontroluj e-mail. Odkaz platí 15 minut.' };
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect('/login');
}
