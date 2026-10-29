'use client';

import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react';
import { cn, focusRing } from '@/ui/cn';
import { Tabs } from '@/ui/Tabs';
import { unresolvedLabel } from './model';

export type SidebarTab = 'comments' | 'checks' | 'versions';

const PEEK_HEIGHT = 'h-[calc(244px+env(safe-area-inset-bottom))]';
const DRAG_THRESHOLD = 36;

/**
 * Right column on desktop; on phones the same element is a bottom sheet that peeks above the action
 * bar and expands (tap or drag the handle) to 85 % of the screen. Layout only: the panels are passed in.
 */
export function ReviewSidebar({
  tab,
  onTab,
  expanded,
  onExpandedChange,
  commentCount,
  unresolved,
  peek,
  scrollTo,
  composer,
  children,
}: {
  tab: SidebarTab;
  onTab: (tab: SidebarTab) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  commentCount: number;
  unresolved: number;
  /** One-comment summary shown in the collapsed phone sheet. */
  peek: ReactNode;
  /** Comment id to bring into view; a new object re-triggers it. */
  scrollTo: { id: string } | null;
  composer: ReactNode;
  children: ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<number | null>(null);

  useEffect(() => {
    if (!scrollTo) return;
    const container = scroller.current;
    const card = container?.querySelector<HTMLElement>(`[data-comment-id="${CSS.escape(scrollTo.id)}"]`);
    if (container && card) container.scrollTo({ top: card.offsetTop - 8, behavior: 'smooth' });
  }, [scrollTo]);

  // The page behind a full-height sheet must not scroll.
  useEffect(() => {
    if (!expanded || window.matchMedia('(min-width: 1024px)').matches) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [expanded]);

  function onPointerDown(event: PointerEvent) {
    drag.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function onPointerUp(event: PointerEvent) {
    if (drag.current === null) return;
    const delta = drag.current - event.clientY;
    drag.current = null;
    if (Math.abs(delta) < 8) onExpandedChange(!expanded);
    else if (delta > DRAG_THRESHOLD) onExpandedChange(true);
    else if (delta < -DRAG_THRESHOLD) onExpandedChange(false);
  }

  const tabs = [
    { id: 'comments', label: `Komentáře · ${commentCount}` },
    { id: 'checks', label: 'Kontrola' },
    { id: 'versions', label: 'Verze' },
  ];

  return (
    <>
      {expanded && (
        <button
          type="button"
          aria-label="Sbalit komentáře"
          onClick={() => onExpandedChange(false)}
          className="fixed inset-0 z-[55] bg-ink/40 lg:hidden"
        />
      )}
      <aside
        aria-label="Komentáře a kontrola"
        className={cn(
          'fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-card bg-card shadow-[0_-8px_32px_rgba(23,21,31,0.14)] transition-[height] duration-200 md:left-[100px]',
          expanded ? 'z-[60] h-[85dvh]' : PEEK_HEIGHT,
          'lg:sticky lg:top-8 lg:z-auto lg:h-[calc(100dvh-4rem)] lg:rounded-none lg:bg-transparent lg:shadow-none',
        )}
      >
        <div
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (drag.current = null)}
          // Pointer taps are handled above; this catches clicks synthesised by assistive technology.
          onClick={(event) => {
            if (event.detail === 0) onExpandedChange(!expanded);
          }}
          role="button"
          tabIndex={0}
          aria-expanded={expanded}
          aria-label={expanded ? 'Sbalit komentáře' : 'Rozbalit komentáře'}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onExpandedChange(!expanded);
            }
          }}
          className={cn('flex touch-none justify-center pt-3 pb-2 lg:hidden', focusRing)}
        >
          <span aria-hidden className="h-1.5 w-10 rounded-full bg-lavender" />
        </div>

        {expanded ? null : (
          <div className="flex items-center justify-between gap-3 px-5 pb-2 lg:hidden">
            <h2 className="text-h2">Komentáře · {commentCount}</h2>
            {unresolved > 0 && (
              <span className="rounded-pill bg-apricot-soft px-3 py-1.5 text-sm font-semibold text-apricot-ink">
                {unresolvedLabel(unresolved)}
              </span>
            )}
          </div>
        )}

        <div className={cn('items-center gap-2 px-4 pb-3 lg:flex lg:px-0 lg:pt-0 lg:pb-4', expanded ? 'flex' : 'hidden')}>
          <Tabs
            label="Panel komentářů"
            variant="light"
            items={tabs}
            value={tab}
            onChange={(id) => onTab(id as SidebarTab)}
            className="min-w-0 flex-1 max-lg:bg-nest [&>button]:flex-1 max-lg:[&>button]:px-2"
          />
          <button
            type="button"
            onClick={() => onExpandedChange(false)}
            aria-label="Sbalit komentáře"
            className={cn('flex size-12 shrink-0 items-center justify-center rounded-full bg-nest lg:hidden', focusRing)}
          >
            <ChevronDown aria-hidden className="size-5" />
          </button>
        </div>

        {!expanded && <div className="px-4 lg:hidden">{peek}</div>}

        <div
          ref={scroller}
          className={cn(
            'relative min-h-0 flex-1 overflow-y-auto px-4 pb-4 lg:block lg:px-0 lg:pr-1',
            expanded ? 'block' : 'hidden',
          )}
        >
          {children}
        </div>

        <div
          className={cn(
            'px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] lg:block lg:px-0 lg:pt-3 lg:pb-0',
            expanded && tab === 'comments' ? 'block' : 'hidden',
          )}
        >
          {composer}
        </div>
      </aside>
    </>
  );
}
