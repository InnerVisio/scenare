'use client';

import { useActionState } from 'react';
import { requestLink, type LoginState } from './actions';

const INITIAL: LoginState = { status: 'idle', message: '' };

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(requestLink, INITIAL);

  if (state.status === 'sent') {
    return (
      <p role="status" className="rounded-inner bg-nest p-4 text-script">
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="dalsi" value={next} /> : null}
      <label className="flex flex-col gap-2">
        <span className="text-label uppercase text-text2">E-mail</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          autoFocus
          placeholder="jmeno@firma.cz"
          className="min-h-12 rounded-inner bg-nest px-4 text-script outline-none focus:ring-2 focus:ring-violet"
        />
      </label>
      {state.status === 'error' ? (
        <p role="alert" className="text-coral">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-pill bg-lime px-6 font-semibold text-ink disabled:opacity-60"
      >
        {pending ? 'Posílám…' : 'Poslat přihlašovací odkaz'}
      </button>
    </form>
  );
}
