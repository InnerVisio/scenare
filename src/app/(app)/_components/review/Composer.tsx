'use client';

import { Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  showTypeSelect = true,
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
  /** Leaders always write remarks; only admins pick a type. */
  showTypeSelect?: boolean;
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
  const [mobile, setMobile] = useState(false);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);
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
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setMobile(!mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Phone: every request for the composer opens the full-screen overlay.
  useEffect(() => {
    if (focusToken === 0 || !mobile) return;
    (document.activeElement as HTMLElement | null)?.blur();
    window.getSelection()?.removeAllRanges();
    setOpen(true);
  }, [focusToken, mobile]);

  const overlay = mobile && open;

  // Size the overlay to the visual viewport (the keyboard shrinks it) and freeze the page behind.
  useEffect(() => {
    if (!overlay) return;
    const vv = window.visualViewport;
    const sync = () => setBox(vv ? { top: vv.offsetTop, height: vv.height } : null);
    sync();
    vv?.addEventListener('resize', sync);
    vv?.addEventListener('scroll', sync);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      vv?.removeEventListener('resize', sync);
      vv?.removeEventListener('scroll', sync);
      document.body.style.overflow = prev;
    };
  }, [overlay]);

  useEffect(() => {
    if (!overlay) return;
    const el = isSuggestion ? replacementRef.current : bodyRef.current;
    el?.focus();
    el?.setSelectionRange(el.value.length, el.value.length);
    window.getSelection()?.removeAllRanges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlay, focusToken]);

  function close() {
    setOpen(false);
    onCancelTarget();
  }

  useEffect(() => {
    if (focusToken === 0 || mobile) return;
    const el = isSuggestion ? replacementRef.current : bodyRef.current;
    el?.focus();
    el?.setSelectionRange(el.value.length, el.value.length);
    // Only a new request moves focus, not later re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken]);

  const expanded = overlay || focused || text !== '' || target.kind !== 'general';
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
      setOpen(false);
      setText('');
      setReplacement('');
      setType('remark');
    }
  }

  if (mobile) {
    const field = 'w-full resize-none rounded-[18px] border border-ink/25 bg-white px-4 py-3 text-base leading-6 outline-none focus:border-ink';
    return (
      <>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            window.getSelection()?.removeAllRanges();
          }}
          className={cn('min-h-12 w-full rounded-inner bg-nest p-4 text-left text-text2', focusRing)}
        >
          Napiš komentář…
        </button>
        {overlay &&
          createPortal(
            <form
              data-composer
              role="dialog"
              aria-modal="true"
              aria-label={isSuggestion ? 'Návrh změny' : 'Komentář'}
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
              style={box ? { top: box.top, height: box.height } : { top: 0, height: '100dvh' }}
              className="fixed inset-x-0 z-[100] flex flex-col gap-3 overflow-hidden bg-card px-4 pb-3"
            >
              <div className="flex h-12 shrink-0 items-center justify-between">
                <h2 className="text-lg font-semibold">{isSuggestion ? 'Návrh změny' : 'Komentář'}</h2>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Zavřít"
                  className={cn('-mr-3 flex size-12 items-center justify-center rounded-full hover:bg-ink/5', focusRing)}
                >
                  <X aria-hidden className="size-6" />
                </button>
              </div>
              {anchor && (
                <p className="max-h-24 shrink-0 overflow-y-auto rounded-inner bg-nest px-3 py-2 text-sm text-text2">
                  <span className="font-semibold text-ink">{isSuggestion ? 'Původně' : 'K textu'}</span>{' '}
                  <span className={cn(isSuggestion && 'text-danger-text line-through')}>„{anchor.quotedText}“</span>
                </p>
              )}
              {isSuggestion ? (
                <>
                  <label htmlFor="suggestion-text" className="-mb-1 shrink-0 text-sm font-semibold text-text2">
                    Nový text
                  </label>
                  <textarea
                    id="suggestion-text"
                    ref={replacementRef}
                    value={replacement}
                    onChange={(event) => setReplacement(event.target.value)}
                    className={cn(field, 'min-h-[120px] flex-1')}
                  />
                  <input
                    type="text"
                    aria-label="Proč? (nepovinné)"
                    placeholder="Proč? (nepovinné)"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    className="h-12 shrink-0 rounded-[18px] border border-ink/25 bg-white px-4 text-base outline-none focus:border-ink"
                  />
                </>
              ) : (
                <>
                  <textarea
                    ref={bodyRef}
                    aria-label="Komentář"
                    placeholder={target.kind === 'general' ? 'Napiš obecný komentář…' : 'Napiš komentář… @ pro zmínku'}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    className={cn(field, 'min-h-[120px] flex-1')}
                  />
                  {showTypeSelect && (
                    <>
                      <label htmlFor="comment-type" className="sr-only">
                        Typ komentáře
                      </label>
                      <select
                        id="comment-type"
                        value={type}
                        onChange={(event) => setType(event.target.value as CommentType)}
                        className={cn('min-h-12 shrink-0 rounded-pill bg-nest px-4 text-base font-semibold', focusRing)}
                      >
                        {COMMENT_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {COMMENT_TYPE_LABELS[t]}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </>
              )}
              {error && (
                <p role="alert" className="shrink-0 rounded-inner bg-danger-bg px-4 py-3 text-sm font-semibold text-danger-text">
                  {error}
                </p>
              )}
              <button
                type="submit"
                aria-busy={busy || undefined}
                disabled={!canSend}
                className={cn('h-12 w-full shrink-0 rounded-pill bg-ink font-semibold text-lime transition-opacity disabled:opacity-40', focusRing)}
              >
                Odeslat
              </button>
            </form>,
            document.body,
          )}
      </>
    );
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
          placeholder={isSuggestion ? 'Proč? (nepovinné)' : target.kind === 'general' ? 'Napiš obecný komentář…' : 'Napiš komentář… @ pro zmínku'}
          value={text}
          onChange={setText}
          users={users}
          onSubmitShortcut={() => void submit()}
        />
        <button
          type="submit"
          aria-busy={busy || undefined}
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
      {expanded && !isSuggestion && showTypeSelect && (
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
