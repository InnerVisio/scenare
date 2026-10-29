'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { cn, focusRing } from '@/ui/cn';

const MARGIN = 8;
const GAP = 12;
const MOBILE_MAX_WIDTH = 767;

const ACTION =
  'inline-flex min-h-12 items-center justify-center rounded-pill px-4 text-base font-semibold whitespace-nowrap text-card transition-colors hover:bg-ink2 disabled:pointer-events-none disabled:opacity-40';

/**
 * Floating action pill for a text selection. `rect` is the selection's viewport rectangle. On phones
 * the pill sits below the selection (the native handles and callout are above it); on larger screens
 * it sits above. It is clamped to the viewport horizontally and flips if there is no room.
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
  const [pos, setPos] = useState({ left: MARGIN, top: -1000 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const left = Math.min(Math.max(rect.left + rect.width / 2 - width / 2, MARGIN), Math.max(window.innerWidth - width - MARGIN, MARGIN));
    const below = rect.bottom + GAP;
    const above = rect.top - height - GAP;
    const preferBelow = window.innerWidth <= MOBILE_MAX_WIDTH;
    const fitsBelow = below + height <= window.innerHeight - MARGIN;
    const fitsAbove = above >= MARGIN;
    const top = preferBelow ? (fitsBelow || !fitsAbove ? below : above) : fitsAbove || !fitsBelow ? above : below;
    setPos({ left, top: Math.min(Math.max(top, MARGIN), Math.max(window.innerHeight - height - MARGIN, MARGIN)) });
  }, [rect.left, rect.top, rect.width, rect.height, rect.bottom]);

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
