'use client';

import { useState } from 'react';
import { Button } from '@/ui/Button';
import { Field, Textarea } from '@/ui/Field';
import { ReviewDialog } from '../review/ReviewDialog';

/** „Odeslat ke kontrole“: an optional note on what changed, plus a heads-up about unmet checks (never blocking). */
export function SubmitDialog({
  open,
  busy,
  error,
  warnings,
  hasPreviousVersion,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  busy: boolean;
  error: string | null;
  /** Labels of the checks that do not pass yet. */
  warnings: string[];
  hasPreviousVersion: boolean;
  onSubmit: (changeSummary: string) => void;
  onCancel: () => void;
}) {
  const [summary, setSummary] = useState('');
  return (
    <ReviewDialog open={open} onClose={onCancel} title="Odeslat ke kontrole">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy) onSubmit(summary.trim());
        }}
        className="flex flex-col gap-4"
      >
        <Field label="Co jsem změnil (nepovinné)">
          <Textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder={hasPreviousVersion ? 'Např. zkrácený hook, doplněný zdroj' : 'Např. první verze'}
            maxLength={500}
            className="min-h-24"
          />
        </Field>
        {warnings.length > 0 && (
          <div className="rounded-inner bg-apricot-soft p-4 text-apricot-ink">
            <p className="font-semibold">Kontrolní seznam ještě není splněný:</p>
            <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-5">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
            <p className="mt-2 text-sm">Odeslat můžeš i tak, vedení uvidí, co chybí.</p>
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-inner bg-danger-bg px-4 py-3 font-semibold text-danger-text">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Zrušit
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Odesílám…' : 'Odeslat ke kontrole'}
          </Button>
        </div>
      </form>
    </ReviewDialog>
  );
}
