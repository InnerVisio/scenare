import { requireActor } from '@/server/auth/session';
import { logout } from './login/actions';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const actor = await requireActor();
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-4 px-4">
      <h1 className="text-h1">GTA Scénáře</h1>
      <p className="text-text2">Přihlášen jako {actor.name}.</p>
      <form action={logout}>
        <button type="submit" className="min-h-12 rounded-pill bg-ink px-6 font-semibold text-card">
          Odhlásit se
        </button>
      </form>
    </main>
  );
}
