'use client';

import { useState } from 'react';
import { Button } from '@/ui/Button';
import { cn, focusRing } from '@/ui/cn';
import { ReviewDialog } from './ReviewDialog';

/**
 * „Vrátit k dopracování“ with the note for the author. The note is required unless the actor has
 * already commented on this version (those comments travel with the return).
 */
export function ReturnDialog({
  open,
  hasOwnComments,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  hasOwnComments: boolean;
  busy: boolean;
  error: string | null;
  onSubmit: (note: string) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState('');
  const missing = !hasOwnComments && note.trim() === '';

  return (
    <ReviewDialog open={open} onClose={onCancel} title="Vrátit k dopracování">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!missing) onSubmit(note.trim());
        }}
        className="flex flex-col gap-3"
      >
        <label htmlFor="return-note" className="font-semibold">
          Co je potřeba upravit?
        </label>
        <textarea
          id="return-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={4}
          required={!hasOwnComments}
          className={cn('w-full resize-none rounded-inner bg-nest p-4 text-base', focusRing)}
        />
        {hasOwnComments && <p className="text-sm text-text2">Tvoje komentáře k této verzi se pošlou spolu s vrácením.</p>}
        {error && (
          <p role="alert" className="rounded-inner bg-danger-bg px-4 py-3 text-sm font-semibold text-danger-text">
            {error}
          </p>
        )}
        <div className="mt-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Zrušit
          </Button>
          <Button type="submit" variant="danger" disabled={busy || missing}>
            Vrátit k dopracování
          </Button>
        </div>
      </form>
    </ReviewDialog>
  );
}
