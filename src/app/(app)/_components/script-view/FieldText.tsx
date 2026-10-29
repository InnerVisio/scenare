'use client';

import { Fragment, type MouseEvent, type ReactNode } from 'react';
import { cn } from '@/ui/cn';
import { buildSegments } from './highlight';
import type { AnchoredThread } from './types';

export type FieldTone = 'light' | 'dark';

const LOOK: Record<
  FieldTone,
  { anchored: string; active: string; struck: string; replacement: string; badge: string }
> = {
  light: {
    anchored: 'bg-mark',
    active: 'bg-violet text-white',
    struck: 'bg-danger-bg text-danger-text line-through decoration-1',
    replacement: 'bg-lime/70 text-ink',
    badge: 'bg-ink text-lime',
  },
  dark: {
    anchored: 'bg-violet/55 text-white',
    active: 'bg-violet text-white',
    struck: 'bg-coral/30 text-white line-through decoration-1',
    replacement: 'bg-lime text-ink',
    badge: 'bg-lime text-ink',
  },
};

const MARK = 'rounded-[6px] px-0.5 box-decoration-clone';

/** Splits at the last whitespace: `['Ke dni ', 'konce']`. A single word yields an empty head. */
function splitLastWord(value: string): [string, string] {
  const match = /^([\s\S]*\s)(\S*)$/.exec(value);
  return match ? [match[1], match[2]] : ['', value];
}

function hasPendingSuggestion(thread: AnchoredThread): boolean {
  return thread.suggestion?.state === 'pending';
}

/**
 * One commentable field. The outer span holds only the field's text (selection offsets are measured
 * against it); badges and replacement text are `data-nontext` so they never count as source text.
 */
export function FieldText({
  fieldId,
  text,
  threads = [],
  activeThreadId,
  onAnchorClick,
  tone = 'light',
  className,
}: {
  fieldId: string;
  text: string;
  threads?: AnchoredThread[];
  activeThreadId?: string;
  onAnchorClick?: (threadId: string) => void;
  tone?: FieldTone;
  className?: string;
}) {
  const look = LOOK[tone];
  const segments = buildSegments(text, fieldId, threads);

  function click(event: MouseEvent, threadId: string) {
    event.stopPropagation();
    onAnchorClick?.(threadId);
  }

  /** A click that ends a text selection must not count as tapping the highlight (the badge is exempt). */
  function clickHighlight(event: MouseEvent, threadId: string) {
    if (typeof window !== 'undefined' && window.getSelection()?.isCollapsed === false) return;
    click(event, threadId);
  }

  const mark = (owner: AnchoredThread, content: string, key?: string) => (
    <span
      key={key}
      data-thread-id={owner.id}
      onClick={onAnchorClick ? (event) => clickHighlight(event, owner.id) : undefined}
      className={cn(
        MARK,
        onAnchorClick && 'cursor-pointer',
        owner.id === activeThreadId ? look.active : hasPendingSuggestion(owner) ? look.struck : look.anchored,
        owner.id === activeThreadId && hasPendingSuggestion(owner) && 'line-through decoration-1',
      )}
    >
      {content}
    </span>
  );

  const replacement = (content: string, spaced: boolean, key?: string) => (
    <span key={key} data-nontext className={cn(MARK, 'select-none', spaced && 'ml-1', look.replacement)}>
      {content}
    </span>
  );

  const badge = (thread: AnchoredThread) => (
    <button
      key={thread.id}
      type="button"
      data-nontext
      aria-label={`Komentář ${thread.index}`}
      onClick={(event) => click(event, thread.id)}
      className={cn(
        'relative -top-px mx-1 rounded-full px-[6px] py-[2px] text-[11px] leading-none font-semibold select-none',
        look.badge,
      )}
    >
      {thread.index}
    </button>
  );

  // A badge must never wrap onto a line of its own: it is glued to the last word before it.
  const glued = (children: ReactNode) => <span className="whitespace-nowrap">{children}</span>;

  return (
    <span data-field-id={fieldId} className={className}>
      {segments.map((segment) => {
        const content = text.slice(segment.from, segment.to);
        const owner = segment.owner;
        if (!owner) return <Fragment key={segment.from}>{content}</Fragment>;

        const earlier = segment.ends.slice(0, -1);
        const last = segment.ends.at(-1);
        const lastReplacement = last?.suggestion?.state === 'pending' ? last.suggestion.replacement : null;

        // Common case: one badge right after the highlighted text.
        if (last && earlier.length === 0 && lastReplacement === null) {
          const [head, word] = splitLastWord(content);
          return (
            <Fragment key={segment.from}>
              {head && mark(owner, head)}
              {glued(
                <>
                  {word && mark(owner, word)}
                  {badge(last)}
                </>,
              )}
            </Fragment>
          );
        }

        const [head, word] = lastReplacement !== null ? splitLastWord(lastReplacement) : ['', ''];
        return (
          <Fragment key={segment.from}>
            {mark(owner, content)}
            {earlier.map((thread) => (
              <Fragment key={thread.id}>
                {thread.suggestion?.state === 'pending' && replacement(thread.suggestion.replacement, true)}
                {badge(thread)}
              </Fragment>
            ))}
            {last &&
              (lastReplacement !== null ? (
                <>
                  {head && replacement(head, true)}
                  {glued(
                    <>
                      {word && replacement(word, !head)}
                      {badge(last)}
                    </>,
                  )}
                </>
              ) : (
                glued(badge(last))
              ))}
          </Fragment>
        );
      })}
    </span>
  );
}
