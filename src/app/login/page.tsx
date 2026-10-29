import Link from 'next/link';
import { safeNextPath } from '@/server/auth/magicLink';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Přihlášení – GTA Scénáře' };

const showDevLogin = () => process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEV_LOGIN === '1';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ chyba?: string; dalsi?: string }>;
}) {
  const { chyba, dalsi } = await searchParams;
  const next = safeNextPath(dalsi) ?? undefined;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-10">
      <h1 className="text-h1">GTA Scénáře</h1>
      <section className="flex flex-col gap-4 rounded-card bg-card p-6 sm:p-8">
        <h2 className="text-h2">Přihlášení</h2>
        <p className="text-text2">Pošleme ti e-mail s odkazem, kterým se přihlásíš. Heslo nepotřebuješ.</p>
        {chyba === 'odkaz' ? (
          <p role="alert" className="rounded-inner bg-nest p-4 text-coral">
            Odkaz vypršel nebo už byl použitý. Pošli si nový.
          </p>
        ) : null}
        <LoginForm next={next} />
      </section>
      {showDevLogin() ? (
        <Link href="/dev-login" className="inline-flex min-h-12 items-center text-violet underline">
          Vývojové přihlášení bez e-mailu
        </Link>
      ) : null}
    </main>
  );
}
