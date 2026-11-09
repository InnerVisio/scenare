'use client';

import { useActionState } from 'react';
import { loginWithPassword } from './actions';

const INPUT = 'min-h-12 rounded-inner bg-nest px-4 text-script outline-none focus:ring-2 focus:ring-violet';

export function PasswordForm() {
  const [error, action, pending] = useActionState(loginWithPassword, '');
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-label uppercase text-text2">E-mail</span>
        <input type="email" name="email" required autoComplete="username" className={INPUT} />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-label uppercase text-text2">Heslo</span>
        <input type="password" name="password" required autoComplete="current-password" className={INPUT} />
      </label>
      {error ? (
        <p role="alert" className="text-coral">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className="min-h-12 rounded-pill bg-lime px-6 font-semibold text-ink disabled:opacity-60">
        {pending ? 'Přihlašuji…' : 'Přihlásit se'}
      </button>
    </form>
  );
}
