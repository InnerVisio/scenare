const MARGIN = 8;
const GAP_FINE = 12;
/** Touch devices draw native selection handles and a callout around the selection, so keep clear of them. */
const GAP_COARSE = 28;

export interface ToolbarPlacement {
  rect: Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>;
  size: { width: number; height: number };
  viewport: { width: number; height: number };
  /** `(pointer: coarse)`: a finger, not a mouse. */
  coarse: boolean;
}

/**
 * Fixed-position coordinates for the selection toolbar: below the selection on coarse pointers (the
 * native callout is above it), above on fine ones; flips when there is no room and is clamped to the
 * viewport.
 */
export function placeToolbar({ rect, size, viewport, coarse }: ToolbarPlacement): { left: number; top: number } {
  const gap = coarse ? GAP_COARSE : GAP_FINE;
  const left = Math.min(
    Math.max(rect.left + rect.width / 2 - size.width / 2, MARGIN),
    Math.max(viewport.width - size.width - MARGIN, MARGIN),
  );
  const below = rect.bottom + gap;
  const above = rect.top - size.height - gap;
  const fitsBelow = below + size.height <= viewport.height - MARGIN;
  const fitsAbove = above >= MARGIN;
  const top = coarse ? (fitsBelow || !fitsAbove ? below : above) : fitsAbove || !fitsBelow ? above : below;
  return { left, top: Math.min(Math.max(top, MARGIN), Math.max(viewport.height - size.height - MARGIN, MARGIN)) };
}

export function isCoarsePointer(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}
