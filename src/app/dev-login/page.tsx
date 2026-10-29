import { asc } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';
import { getDb } from '@/db/client';
import * as s from '@/db/schema';
import { createSession } from '@/server/auth/session';

export const metadata = { title: 'Vývojové přihlášení – GTA Scénáře' };
export const dynamic = 'force-dynamic';

const ROLE_LABELS: Record<s.UserRole, string> = {
  admin: 'Admin (autor scénářů)',
  marketer: 'Marketér',
  leadership: 'Vedení',
  production: 'Produkce',
};

const devLoginEnabled = () => process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEV_LOGIN === '1';

async function loginAs(formData: FormData) {
  'use server';
  if (!devLoginEnabled()) notFound();
  await createSession(String(formData.get('userId') ?? ''));
  redirect('/');
}

export default async function DevLoginPage() {
  if (!devLoginEnabled()) notFound();
  const users = await (await getDb()).select().from(s.users).orderBy(asc(s.users.name));

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-10">
      <h1 className="text-h1">Vývojové přihlášení</h1>
      <p className="text-text2">Jen pro vývoj a ukázky. Klikni na uživatele a jsi uvnitř.</p>
      {users.length === 0 ? (
        <p className="rounded-card bg-card p-6">Žádní uživatelé. Spusť „npm run db:seed -- --demo“.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {users.map((user) => (
            <li key={user.id}>
              <form action={loginAs}>
                <input type="hidden" name="userId" value={user.id} />
                <button
                  type="submit"
                  className="flex min-h-16 w-full flex-col items-start justify-center rounded-card bg-card px-6 py-3 text-left hover:bg-nest focus:outline-none focus:ring-2 focus:ring-violet"
                >
                  <span className="text-h2">{user.name}</span>
                  <span className="text-text2">{ROLE_LABELS[user.role]}</span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
