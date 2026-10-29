'use client';

import { useState } from 'react';
import { formatRelative } from '@/domain/format/date';
import { COMMENT_STATUS_LABELS, COMMENT_TYPE_LABELS } from '@/domain/workflow/comments';
import type { ReviewPerms, ThreadVM } from '@/server/review';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { cn, focusRing } from '@/ui/cn';
import { MentionField } from './MentionField';
import { mentionedIds } from './model';

export interface CommentActions {
  reply: (threadId: string, body: string, mentions: string[]) => Promise<boolean>;
  close: (threadId: string) => Promise<boolean>;
  reopen: (threadId: string) => Promise<boolean>;
  address: (threadId: string) => Promise<boolean>;
  accept: (threadId: string) => Promise<boolean>;
  reject: (threadId: string, reason: string) => Promise<boolean>;
}

const STATUS_PILL = {
  open: 'bg-apricot-soft text-apricot-ink',
  addressed: 'bg-lime-soft text-lime-ink',
  closed: 'bg-grey-soft text-ink2',
  suggestion: 'bg-violet-soft text-violet-ink',
} as const;

const TYPE_TAG = {
  remark: 'bg-grey-soft text-ink2',
  expert: 'bg-sun-soft text-sun-ink',
  change_request: 'bg-violet-soft text-violet-ink',
  idea: 'bg-mint text-mint-ink',
  approval: 'bg-lime-soft text-lime-ink',
} as const;

const PILL = 'inline-flex items-center rounded-pill px-3 py-1.5 text-sm leading-none font-semibold whitespace-nowrap';

export const avatarTone = (initials: string) => (initials.toLocaleUpperCase('cs') === 'H' ? 'mint' : 'lavender');

export function CommentCard({
  thread,
  active,
  perms,
  users,
  now,
  actions,
  onActivate,
}: {
  thread: ThreadVM;
  active: boolean;
  perms: ReviewPerms;
  users: { id: string; name: string }[];
  now: Date;
  actions: CommentActions;
  onActivate: (threadId: string) => void;
}) {
  const [mode, setMode] = useState<'idle' | 'reply' | 'reject'>('idle');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const pendingSuggestion = thread.suggestion?.state === 'pending';
  const pillKey = pendingSuggestion ? 'suggestion' : thread.status;
  const pillLabel = pendingSuggestion ? 'Návrh změny' : COMMENT_STATUS_LABELS[thread.status];
  const showTypeTag = thread.type !== 'remark' && !thread.suggestion;

  async function run(action: () => Promise<boolean>, afterSuccess?: () => void) {
    setBusy(true);
    try {
      if (await action()) {
        setDraft('');
        setMode('idle');
        afterSuccess?.();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      id={`comment-${thread.id}`}
      data-comment-id={thread.id}
      data-status={thread.status}
      aria-label={`Komentář ${thread.index}`}
      onClick={() => onActivate(thread.id)}
      className={cn(
        'flex flex-col gap-3 rounded-inner bg-nest p-4 lg:rounded-card lg:bg-card lg:p-5',
        active && 'ring-2 ring-violet',
      )}
    >
      <header className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            'mt-2 flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
            active ? 'bg-violet text-white' : 'bg-ink text-lime',
          )}
        >
          {thread.index}
        </span>
        <Avatar initials={thread.authorInitials} tone={avatarTone(thread.authorInitials)} />
        <div className="min-w-0 flex-1">
          <p className="truncate leading-tight font-semibold">{thread.authorName}</p>
          <p className="text-sm text-text2">{formatRelative(new Date(thread.createdAt), now)}</p>
        </div>
        <span className={cn(PILL, STATUS_PILL[pillKey])}>{pillLabel}</span>
      </header>

      {thread.anchor && (
        <p className="border-l-4 border-violet-tint pl-3 text-sm text-text2">
          {thread.isDetached && <span className="mr-1 font-semibold text-apricot-ink">Odpojeno · původně:</span>}„{thread.anchor.quotedText}“
        </p>
      )}
      {showTypeTag && <span className={cn(PILL, 'w-fit', TYPE_TAG[thread.type])}>{COMMENT_TYPE_LABELS[thread.type]}</span>}

      <p className="break-words whitespace-pre-wrap">{thread.body}</p>

      {thread.suggestion && (
        <div className="rounded-xl bg-card p-3 text-sm lg:bg-nest">
          <p className="font-semibold text-text2">Navrhovaný text</p>
          <p className="mt-1">
            {thread.suggestion.replacement === '' ? (
              <span className="text-text2 italic">(text smazat)</span>
            ) : (
              <span className="rounded-md bg-lime/70 px-1">{thread.suggestion.replacement}</span>
            )}
          </p>
          {thread.suggestion.state === 'accepted' && <p className="mt-2 font-semibold text-lime-ink">Návrh přijat</p>}
          {thread.suggestion.state === 'rejected' && (
            <p className="mt-2 font-semibold text-danger-text">
              Návrh odmítnut{thread.suggestion.reason ? `: ${thread.suggestion.reason}` : ''}
            </p>
          )}
        </div>
      )}

      {thread.replies.length > 0 && (
        <ul className="flex flex-col gap-2">
          {thread.replies.map((reply) => (
            <li key={reply.id} className="flex items-start gap-3 rounded-inner bg-card p-3 lg:bg-nest">
              <Avatar initials={reply.authorInitials} tone={avatarTone(reply.authorInitials)} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-text2">
                  <span className="font-semibold text-ink">{reply.authorName}</span> · {formatRelative(new Date(reply.createdAt), now)}
                </p>
                <p className="break-words whitespace-pre-wrap">{reply.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {mode !== 'idle' && (
        <form
          onClick={(event) => event.stopPropagation()}
          onSubmit={(event) => {
            event.preventDefault();
            const text = draft.trim();
            if (!text) return;
            if (mode === 'reply') void run(() => actions.reply(thread.id, text, mentionedIds(text, users)));
            else void run(() => actions.reject(thread.id, text));
          }}
          className="flex flex-col gap-2 rounded-inner bg-card p-2 pl-3 lg:bg-nest"
        >
          <MentionField
            aria-label={mode === 'reply' ? 'Odpověď' : 'Důvod odmítnutí'}
            placeholder={mode === 'reply' ? 'Napiš odpověď…' : 'Proč návrh odmítáš?'}
            value={draft}
            onChange={setDraft}
            users={mode === 'reply' ? users : []}
            autoFocus
          />
          <div className="flex gap-2">
            <Button type="submit" variant={mode === 'reply' ? 'primary' : 'danger'} disabled={busy || draft.trim() === ''}>
              {mode === 'reply' ? 'Odeslat odpověď' : 'Odmítnout návrh'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setMode('idle');
                setDraft('');
              }}
            >
              Zrušit
            </Button>
          </div>
        </form>
      )}

      {mode === 'idle' && (
        <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
          {perms.comment && (
            <Button variant="outline" className="bg-card px-5 lg:bg-nest lg:border-0" onClick={() => setMode('reply')}>
              Odpovědět
            </Button>
          )}
          {pendingSuggestion && perms.decideSuggestion && (
            <>
              <Button variant="approve" disabled={busy} onClick={() => void run(() => actions.accept(thread.id))}>
                Přijmout
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => setMode('reject')}>
                Odmítnout
              </Button>
            </>
          )}
          {thread.status === 'open' && !pendingSuggestion && perms.address && (
            <Button variant="outline" disabled={busy} onClick={() => void run(() => actions.address(thread.id))}>
              Zapracováno
            </Button>
          )}
          {thread.status !== 'closed' && perms.close && (
            <Button variant="primary" disabled={busy} onClick={() => void run(() => actions.close(thread.id))}>
              Uzavřít
            </Button>
          )}
          {thread.status !== 'open' && perms.reopen && (
            <Button variant="outline" disabled={busy} onClick={() => void run(() => actions.reopen(thread.id))}>
              Znovu otevřít
            </Button>
          )}
        </div>
      )}
    </article>
  );
}

/** Two-line summary shown in the collapsed phone sheet. */
export function CommentPreview({ thread, onOpen }: { thread: ThreadVM; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn('flex w-full items-start gap-3 rounded-inner bg-nest p-3 text-left', focusRing)}
    >
      <Avatar initials={thread.authorInitials} tone={avatarTone(thread.authorInitials)} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-text2">
          <b className="text-ink">{thread.authorName}</b>
          {thread.anchor ? ` · k „${thread.anchor.quotedText}“` : ''}
        </span>
        <span className="line-clamp-2">{thread.body}</span>
      </span>
    </button>
  );
}
