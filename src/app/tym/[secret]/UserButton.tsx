'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

/** One big „who are you“ button: disabled as soon as it is clicked. */
export function UserButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className="flex min-h-16 w-full items-center gap-4 rounded-card bg-card px-5 py-3 text-left hover:bg-nest focus:outline-none focus:ring-2 focus:ring-violet disabled:opacity-60"
    >
      {children}
    </button>
  );
}
