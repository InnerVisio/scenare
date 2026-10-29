'use client';

import type { ReviewData } from '@/server/review';
import { CommentCard, type CommentActions } from './CommentCard';
import { groupThreads } from './model';

/** The thread list: numbered cards (open first), then „Odpojené komentáře“ whose text is gone. */
export function CommentsPanel({
  threads,
  activeId,
  perms,
  users,
  now,
  actions,
  onActivate,
}: {
  threads: ReviewData['threads'];
  activeId: string | undefined;
  perms: ReviewData['perms'];
  users: ReviewData['users'];
  now: Date;
  actions: CommentActions;
  onActivate: (threadId: string) => void;
}) {
  const { attached, detached } = groupThreads(threads);
  if (threads.length === 0) {
    return (
      <p className="rounded-card bg-card p-5 text-text2 max-lg:bg-nest">
        Zatím žádné komentáře. Označ ve scénáři text a napiš první.
      </p>
    );
  }
  const card = (thread: ReviewData['threads'][number]) => (
    <li key={thread.id}>
      <CommentCard
        thread={thread}
        active={thread.id === activeId}
        perms={perms}
        users={users}
        now={now}
        actions={actions}
        onActivate={onActivate}
      />
    </li>
  );
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-4">{attached.map(card)}</ul>
      {detached.length > 0 && (
        <section aria-label="Odpojené komentáře" className="flex flex-col gap-3">
          <h3 className="px-1 text-sm font-semibold tracking-[0.04em] text-text2 uppercase">Odpojené komentáře</h3>
          <p className="px-1 text-sm text-text2">Text, ke kterému se vázaly, už ve scénáři není. Komentáře zůstávají zachované.</p>
          <ul className="flex flex-col gap-4">{detached.map(card)}</ul>
        </section>
      )}
    </div>
  );
}
