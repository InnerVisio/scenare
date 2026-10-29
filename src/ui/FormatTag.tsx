import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn';

export type FormatKind = 'verified' | 'test' | 'series';

const KINDS: Record<FormatKind, string> = {
  verified: 'bg-nest text-ink',
  test: 'bg-ink text-lime',
  series: 'border border-dashed border-ink/40 bg-transparent text-ink',
};

export function FormatTag({ kind, children, className }: { kind: FormatKind; children: ReactNode; className?: string }) {
  return (
    <span
      data-format={kind}
      className={cn('inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-sm leading-none font-semibold', KINDS[kind], className)}
    >
      {kind === 'verified' && <Check aria-hidden className="size-4" strokeWidth={2.5} />}
      {children}
    </span>
  );
}
