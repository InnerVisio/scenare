import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn, focusRing } from '@/ui/cn';

/** Round 48 px icon-only button; `label` is its accessible name. */
export function IconButton({
  label,
  children,
  className,
  ...props
}: { label: string; children: ReactNode } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'flex size-12 shrink-0 items-center justify-center rounded-full bg-card text-ink hover:bg-ink/5 disabled:pointer-events-none disabled:opacity-35',
        focusRing,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
