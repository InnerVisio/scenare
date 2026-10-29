'use client';

import { MessageSquare } from 'lucide-react';
import type { ThreadVM } from '@/server/review';
import { cn, focusRing } from '@/ui/cn';

const clip = (text: string, max = 40) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** „2 · Radek · „Ze zákona.““ under a field: a summary of the comments anchored to its text. Click jumps to the card. */
export function FieldThreads({ threads, onOpen, className }: { threads: ThreadVM[] | undefined; onOpen: (threadId: string) => void; className?: string }) {
  if (!threads || threads.length === 0) return null;
  const first = threads[0];
  return (
    <button
      type="button"
      onClick={() => onOpen(first.id)}
      aria-label={`${threads.length} komentářů k tomuto textu, otevřít komentář`}
      className={cn(
        'inline-flex min-h-12 max-w-full items-center gap-2 self-start rounded-pill bg-violet-soft px-4 text-left text-sm font-semibold text-violet-ink',
        focusRing,
        className,
      )}
    >
      <MessageSquare aria-hidden className="size-4 shrink-0" />
      <span className="min-w-0 truncate">
        {threads.length} · {first.authorName}
        {first.anchor ? ` · „${clip(first.anchor.quotedText)}“` : ''}
      </span>
    </button>
  );
}
