'use client';

import { CopyPlus, Lock, MoreHorizontal, Pencil, RotateCcw, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ActionResult } from '@/server/actionResult';
import type { ScriptActions } from '@/server/scripts';
import { Button, ButtonLink } from '@/ui/Button';
import { Field, Textarea } from '@/ui/Field';
import { SubmitDialog } from '../../_components/editor/SubmitDialog';
import { ReviewDialog } from '../../_components/review/ReviewDialog';
import { useReviewToast } from '../../_components/review/ReviewToast';
import { duplicateEpisodeAction, lifecycleAction, submitForReviewAction, unlockScriptAction } from '../actions';

type Dialog = null | 'submit' | 'postpone' | 'cancel';

/** The buttons under a script's header; each one is shown only when the server says the actor may use it. */
export function DetailActions({
  videoId,
  code,
  actions,
  hasPreviousVersion,
  warnings,
}: {
  videoId: string;
  code: string;
  actions: ScriptActions;
  hasPreviousVersion: boolean;
  warnings: string[];
}) {
  const router = useRouter();
  const toast = useReviewToast();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  async function perform<T extends object>(promise: Promise<ActionResult<T>>): Promise<Extract<ActionResult<T>, { ok: true }> | null> {
    setBusy(true);
    setError(null);
    try {
      const result = await promise;
      if (!result.ok) {
        setError(result.message);
        toast(result.message, 'error');
        return null;
      }
      return result;
    } finally {
      setBusy(false);
    }
  }

  const close = () => {
    setDialog(null);
    setError(null);
    setReason('');
  };

  async function submit(changeSummary: string) {
    const result = await perform(submitForReviewAction({ videoId, changeSummary }));
    if (!result) return;
    close();
    toast(`Odesláno ke kontrole (v${result.versionNo})`);
    router.refresh();
  }

  async function pause(action: 'postpone' | 'cancel') {
    if (!reason.trim()) return setError('Napiš důvod.');
    const result = await perform(lifecycleAction({ videoId, action, reason: reason.trim() }));
    if (!result) return;
    close();
    toast(action === 'postpone' ? 'Scénář odložen' : 'Scénář zrušen');
    router.refresh();
  }

  const secondary = actions.pause || actions.restore || actions.duplicate;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.edit && (
        <ButtonLink href={`/scenare/${code}/upravit`} variant="primary">
          <Pencil aria-hidden className="size-4" />
          Upravit
        </ButtonLink>
      )}
      {actions.unlock && (
        <Button
          variant="primary"
          disabled={busy}
          onClick={async () => {
            if (await perform(unlockScriptAction({ videoId }))) router.push(`/scenare/${code}/upravit`);
          }}
        >
          <Lock aria-hidden className="size-4" />
          Odemknout pro úpravu
        </Button>
      )}
      {actions.submit && (
        <Button variant={actions.edit ? 'outline' : 'primary'} onClick={() => setDialog('submit')}>
          <Send aria-hidden className="size-4" />
          Odeslat ke kontrole
        </Button>
      )}
      {actions.openInReview && (
        <ButtonLink href={`/kontrola/${code}`} variant="primary">
          Otevřít v kontrole
        </ButtonLink>
      )}
      {actions.restore && (
        <Button
          variant="primary"
          disabled={busy}
          onClick={async () => {
            if (await perform(lifecycleAction({ videoId, action: 'restore' }))) {
              toast('Scénář obnoven');
              router.refresh();
            }
          }}
        >
          <RotateCcw aria-hidden className="size-4" />
          Obnovit
        </Button>
      )}
      {secondary && (
        <details className="group relative">
          <summary className="inline-flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-pill border border-ink/15 bg-card px-5 font-semibold select-none marker:content-none hover:bg-nest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet [&::-webkit-details-marker]:hidden">
            <MoreHorizontal aria-hidden className="size-5" />
            Další akce
          </summary>
          <div className="mt-2 flex flex-col items-stretch gap-2 rounded-inner bg-nest p-2 sm:absolute sm:top-full sm:left-0 sm:z-20 sm:mt-2 sm:w-72 sm:bg-card sm:shadow-[0_12px_40px_rgba(23,21,31,0.18)]">
            {actions.duplicate && (
              <Button
                variant="ghost"
                className="justify-start"
                disabled={busy}
                onClick={async () => {
                  const result = await perform(duplicateEpisodeAction({ videoId }));
                  if (result) {
                    toast('Další díl série vytvořen');
                    router.push(`/scenare/${result.code}/upravit`);
                  }
                }}
              >
                <CopyPlus aria-hidden className="size-4" />
                Duplikovat jako nový díl série
              </Button>
            )}
            {actions.pause && (
              <>
                <Button variant="ghost" className="justify-start" onClick={() => setDialog('postpone')}>
                  Odložit
                </Button>
                <Button variant="ghost" className="justify-start text-danger-text" onClick={() => setDialog('cancel')}>
                  Zrušit scénář
                </Button>
              </>
            )}
          </div>
        </details>
      )}

      <SubmitDialog
        open={dialog === 'submit'}
        busy={busy}
        error={error}
        warnings={warnings}
        hasPreviousVersion={hasPreviousVersion}
        onSubmit={(summary) => void submit(summary)}
        onCancel={close}
      />
      <ReviewDialog open={dialog === 'postpone' || dialog === 'cancel'} onClose={close} title={dialog === 'cancel' ? 'Zrušit scénář' : 'Odložit scénář'}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (dialog === 'postpone' || dialog === 'cancel') void pause(dialog);
          }}
          className="flex flex-col gap-4"
        >
          <Field label="Důvod">
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} className="min-h-24" />
          </Field>
          {error && (
            <p role="alert" className="rounded-inner bg-danger-bg px-4 py-3 font-semibold text-danger-text">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={close} disabled={busy}>
              Zpět
            </Button>
            <Button type="submit" variant={dialog === 'cancel' ? 'danger' : 'primary'} disabled={busy}>
              {dialog === 'cancel' ? 'Zrušit scénář' : 'Odložit'}
            </Button>
          </div>
        </form>
      </ReviewDialog>
    </div>
  );
}
