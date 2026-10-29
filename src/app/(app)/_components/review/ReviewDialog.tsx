'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '@/ui/cn';

/** Modal that is a bottom sheet on phones and a centred card on desktop. Escape and the backdrop close it. */
export function ReviewDialog({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Prefer a field (the note) over the first button.
    (panel.current?.querySelector<HTMLElement>('textarea, input') ?? panel.current)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center lg:items-center lg:p-6">
      <div aria-hidden className="absolute inset-0 bg-ink/50" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-card bg-card px-5 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] outline-none lg:rounded-card lg:px-7 lg:py-7',
          className,
        )}
      >
        <div aria-hidden className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-lavender lg:hidden" />
        <h2 id={titleId} className="text-h2 mb-3">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
