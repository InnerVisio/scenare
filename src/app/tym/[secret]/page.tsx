import { getDb } from '@/db/client';
import { readSession } from '@/server/auth/session';
import { isTeamLinkSecret, listTeamLinkUsers } from '@/server/settings';
import { signInViaTeamLink } from './actions';
import { UserButton } from './UserButton';

export const metadata = { title: 'Kdo jsi? – GTA Scénáře', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function TeamLinkPage({ params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  const db = await getDb();
  if (!(await isTeamLinkSecret(db, secret))) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-10">
        <h1 className="text-h1">GTA Scénáře</h1>
        <p role="alert" className="rounded-card bg-card p-6 text-h2">
          Tenhle odkaz už neplatí. Požádej Admina o nový.
        </p>
      </main>
    );
  }
  const users = await listTeamLinkUsers(db);
  const session = await readSession();
  const current = session ? users.find((u) => u.id === session.userId) : undefined;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="flex items-center gap-3">
        <span aria-hidden className="flex size-12 items-center justify-center rounded-full bg-lime font-semibold">GTA</span>
        <span className="text-h2">GTA Scénáře</span>
      </div>
      <h1 className="text-h1">Kdo jsi?</h1>
      <ul className="flex flex-col gap-3">
        {users.map((user) => (
          <li key={user.id}>
            <form action={signInViaTeamLink}>
              <input type="hidden" name="secret" value={secret} />
              <input type="hidden" name="userId" value={user.id} />
              <UserButton>
                <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-nest font-semibold">{user.initials}</span>
                <span className="text-h2">{current?.id === user.id ? `Pokračovat jako ${user.name} →` : user.name}</span>
              </UserButton>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
