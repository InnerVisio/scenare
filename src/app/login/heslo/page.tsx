import Link from 'next/link';
import { notFound } from 'next/navigation';
import { passwordLoginEnabled } from '@/server/auth/passwordLogin';
import { PasswordForm } from './PasswordForm';

export const metadata = { title: 'Přihlášení heslem – GTA Scénáře' };
export const dynamic = 'force-dynamic';

export default function PasswordLoginPage() {
  if (!passwordLoginEnabled()) notFound();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-10">
      <h1 className="text-h1">GTA Scénáře</h1>
      <section className="flex flex-col gap-4 rounded-card bg-card p-6 sm:p-8">
        <h2 className="text-h2">Přihlášení heslem (admin)</h2>
        <PasswordForm />
      </section>
      <Link href="/login" className="inline-flex min-h-12 items-center text-violet underline">
        Zpět na přihlášení odkazem
      </Link>
    </main>
  );
}
