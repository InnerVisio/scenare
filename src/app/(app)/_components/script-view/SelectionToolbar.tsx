'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { cn, focusRing } from '@/ui/cn';
import { isCoarsePointer, placeToolbar } from './toolbarPlacement';

const ACTION =
  'inline-flex min-h-12 items-center justify-center rounded-pill px-4 text-base font-semibold whitespace-nowrap text-card transition-colors hover:bg-ink2 disabled:pointer-events-none disabled:opacity-40';

/**
 * Floating action pill for a text selection. `rect` is the selection's viewport rectangle. With a
 * touch pointer the pill sits below the selection (the native handles and callout are above it, so it
 * keeps a 28 px gap); with a mouse it sits above. See `placeToolbar`.
 */
export function SelectionToolbar({
  rect,
  onComment,
  onSuggest,
  onNumber,
  canSuggest,
  canNumber,
}: {
  rect: DOMRect;
  onComment: () => void;
  onSuggest: () => void;
  onNumber: () => void;
  canSuggest: boolean;
  canNumber: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: 8, top: -1000 });

  const { left, top, right, bottom, width, height } = rect;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPos(
      placeToolbar({
        rect: { left, top, right, bottom, width, height },
        size: { width: el.offsetWidth, height: el.offsetHeight },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        coarse: isCoarsePointer(),
      }),
    );
  }, [left, top, right, bottom, width, height]);

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label="Akce s označeným textem"
      // Keep the text selection alive when a button is pressed with a mouse.
      onMouseDown={(event) => event.preventDefault()}
      style={{ left: pos.left, top: pos.top }}
      className="fixed z-50 inline-flex items-center gap-1 rounded-pill bg-ink p-1 shadow-[0_12px_32px_rgba(23,21,31,0.35)]"
    >
      <button
        type="button"
        onClick={onComment}
        className={cn(
          'inline-flex min-h-12 items-center justify-center rounded-pill bg-lime px-5 text-base font-semibold whitespace-nowrap text-ink hover:brightness-95',
          focusRing,
        )}
      >
        Komentovat
      </button>
      <button type="button" onClick={onSuggest} disabled={!canSuggest} className={cn(ACTION, focusRing)}>
        Navrhnout
      </button>
      <button type="button" onClick={onNumber} disabled={!canNumber} className={cn(ACTION, focusRing)}>
        Číslo
      </button>
    </div>
  );
}
