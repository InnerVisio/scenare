'use client';

import { useFormStatus } from 'react-dom';
import type { ReactNode } from 'react';

/** Submit button of the dev-login form: disabled and „…“ the moment it is clicked. */
export function UserButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className="flex min-h-16 w-full flex-col items-start justify-center rounded-card bg-card px-6 py-3 text-left hover:bg-nest focus:outline-none focus:ring-2 focus:ring-violet disabled:opacity-60"
    >
      {children}
      {pending && <span aria-hidden>…</span>}
    </button>
  );
}
