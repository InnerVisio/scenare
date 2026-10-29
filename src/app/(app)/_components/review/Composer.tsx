'use client';

import { Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { NewAnchor } from '@/app/(app)/_components/script-view/types';
import { COMMENT_TYPES, COMMENT_TYPE_LABELS, type CommentType } from '@/domain/workflow/comments';
import { cn, focusRing } from '@/ui/cn';
import { MentionField } from './MentionField';
import { mentionedIds } from './model';

export type ComposerTarget =
  | { kind: 'general' }
  | { kind: 'anchored'; anchor: NewAnchor }
  | { kind: 'suggestion'; anchor: NewAnchor };

export interface ComposerSubmit {
  type: CommentType;
  body: string;
  mentions: string[];
  anchor?: NewAnchor;
  replacement?: string;
}

const SUGGESTION_FALLBACK_BODY = 'Návrh změny textu.';

/**
 * New comment: general, anchored to the selected text, or a suggestion (replacement text plus an
 * optional reason). Stays a one-line pill until it is used.
 */
export function Composer({
  target,
  users,
  busy,
  error,
  focusToken,
  onCancelTarget,
  onSubmit,
  onActiveChange,
}: {
  target: ComposerTarget;
  users: { id: string; name: string }[];
  busy: boolean;
  error: string | null;
  /** Changes whenever the screen wants the composer to take focus. */
  focusToken: number;
  onCancelTarget: () => void;
  /** Resolves true when the comment was saved; the composer then clears itself. */
  onSubmit: (input: ComposerSubmit) => Promise<boolean>;
  /** True while the composer has focus, text or a target; the page does not auto-refresh then. */
  onActiveChange: (active: boolean) => void;
}) {
  const [text, setText] = useState('');
  const [type, setType] = useState<CommentType>('remark');
  const [replacement, setReplacement] = useState('');
  const [focused, setFocused] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const replacementRef = useRef<HTMLTextAreaElement>(null);

  const anchor = target.kind === 'general' ? null : target.anchor;
  const isSuggestion = target.kind === 'suggestion';
  const original = anchor?.quotedText ?? '';

  // A new suggestion starts from the text it replaces.
  useEffect(() => {
    if (target.kind === 'suggestion') setReplacement(target.anchor.quotedText);
  }, [target]);

  useEffect(() => {
    if (focusToken === 0) return;
    const el = isSuggestion ? replacementRef.current : bodyRef.current;
    el?.focus();
    el?.setSelectionRange(el.value.length, el.value.length);
    // Only a new request moves focus, not later re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken]);

  const expanded = focused || text !== '' || target.kind !== 'general';
  useEffect(() => {
    onActiveChange(expanded);
  }, [expanded, onActiveChange]);
  useEffect(() => () => onActiveChange(false), [onActiveChange]);

  const changed = replacement.trim() !== original.trim();
  const canSend = !busy && (isSuggestion ? changed : text.trim() !== '');

  async function submit() {
    if (!canSend) return;
    const body = text.trim() || (isSuggestion ? SUGGESTION_FALLBACK_BODY : '');
    const saved = await onSubmit({
      type: isSuggestion ? 'change_request' : type,
      body,
      mentions: mentionedIds(text, users),
      ...(anchor ? { anchor } : {}),
      ...(isSuggestion ? { replacement: replacement.trim() } : {}),
    });
    if (saved) {
      setText('');
      setReplacement('');
      setType('remark');
    }
  }

  return (
    <form
      data-composer
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
      className="rounded-[28px] bg-card p-2 pl-4 shadow-[0_1px_0_rgba(23,21,31,0.04)] max-lg:bg-nest"
    >
      {anchor && (
        <div className="mr-2 mb-2 flex items-start gap-2 pt-2">
          <p className="min-w-0 flex-1 border-l-4 border-violet-tint pl-3 text-sm text-text2">
            <span className="font-semibold text-ink">{isSuggestion ? 'Navrhuješ změnu textu' : 'K textu'}</span>{' '}
            <span className={cn(isSuggestion && 'rounded-md bg-danger-bg px-1 text-danger-text line-through')}>„{anchor.quotedText}“</span>
          </p>
          <button
            type="button"
            onClick={onCancelTarget}
            aria-label="Zrušit označení textu"
            className={cn('flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-ink/5', focusRing)}
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
      )}
      {isSuggestion && (
        <div className="mr-2 mb-2 rounded-inner bg-nest p-2 max-lg:bg-card">
          <label htmlFor="suggestion-text" className="px-1 text-sm font-semibold text-text2">
            Nový text
          </label>
          <MentionField
            id="suggestion-text"
            inputRef={replacementRef}
            value={replacement}
            onChange={setReplacement}
            users={[]}
            onSubmitShortcut={() => void submit()}
            rows={2}
          />
        </div>
      )}
      <div className="flex items-end gap-2">
        <MentionField
          inputRef={bodyRef}
          aria-label={isSuggestion ? 'Proč návrh? (nepovinné)' : 'Komentář'}
          placeholder={isSuggestion ? 'Proč? (nepovinné)' : 'Napiš komentář… @ pro zmínku'}
          value={text}
          onChange={setText}
          users={users}
          onSubmitShortcut={() => void submit()}
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Odeslat"
          className={cn(
            'flex size-12 shrink-0 items-center justify-center rounded-full bg-ink text-lime transition-opacity disabled:opacity-40',
            focusRing,
          )}
        >
          <Send aria-hidden className="size-5" />
        </button>
      </div>
      {expanded && !isSuggestion && (
        <div className="flex items-center gap-2 pr-2 pb-1 pl-1">
          <label htmlFor="comment-type" className="sr-only">
            Typ komentáře
          </label>
          <select
            id="comment-type"
            value={type}
            onChange={(event) => setType(event.target.value as CommentType)}
            className={cn('min-h-12 rounded-pill bg-nest px-4 text-sm font-semibold max-lg:bg-card', focusRing)}
          >
            {COMMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {COMMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
          <span className="hidden text-xs text-text2 lg:inline">Ctrl + Enter odešle</span>
        </div>
      )}
      {error && (
        <p role="alert" className="mx-1 mt-2 mb-1 rounded-inner bg-danger-bg px-4 py-3 text-sm font-semibold text-danger-text">
          {error}
        </p>
      )}
    </form>
  );
}
