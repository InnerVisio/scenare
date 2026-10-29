'use client';

import { Button } from '@/ui/Button';
import { ReviewDialog } from './ReviewDialog';

/** „Schválit i tak?“ — lists what is still unresolved; confirming approves over those warnings. */
export function ConfirmDialog({
  open,
  blockers,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  blockers: string[];
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ReviewDialog open={open} onClose={onCancel} title="Schválit i tak?">
      <p className="text-text2">Scénář má nevyřešené body:</p>
      <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5">
        {blockers.map((blocker) => (
          <li key={blocker}>{blocker}</li>
        ))}
      </ul>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          Zpět
        </Button>
        <Button variant="approve" onClick={onConfirm} disabled={busy}>
          Schválit i tak
        </Button>
      </div>
    </ReviewDialog>
  );
}
