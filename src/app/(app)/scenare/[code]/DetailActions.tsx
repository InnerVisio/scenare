'use client';

import { CopyPlus, Lock, Undo2, MoreHorizontal, Pencil, RotateCcw, Send, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ActionResult } from '@/server/actionResult';
import type { ScriptActions } from '@/server/scripts';
import { BottomSheet } from '@/ui/BottomSheet';
import { Button, ButtonLink } from '@/ui/Button';
import { Field, Textarea } from '@/ui/Field';
import { SubmitDialog } from '../../_components/editor/SubmitDialog';
import { ReviewDialog } from '../../_components/review/ReviewDialog';
import { useReviewToast } from '../../_components/review/ReviewToast';
import { ShareReviewDialog } from '../../_components/ShareReview';
import { deleteScriptAction, duplicateEpisodeAction, lifecycleAction, submitForReviewAction, unlockScriptAction, withdrawScriptAction } from '../actions';

type Dialog = null | 'submit' | 'postpone' | 'cancel' | 'delete' | 'withdraw';

/** The buttons under a script's header; each one is shown only when the server says the actor may use it. */
export function DetailActions({
  videoId,
  code,
  actions,
  hasPreviousVersion,
  warnings,
  missing,
}: {
  videoId: string;
  code: string;
  actions: ScriptActions;
  hasPreviousVersion: boolean;
  warnings: string[];
  /** Required fields still empty; they block the submit. */
  missing: string[];
}) {
  const router = useRouter();
  const toast = useReviewToast();
  const [menuOpen, setMenuOpen] = useState(false);
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

  const [shared, setShared] = useState<{ titles: string[]; shareUrl: string | null } | null>(null);

  async function submit(changeSummary: string) {
    const result = await perform(submitForReviewAction({ videoId, changeSummary }));
    if (!result) return;
    close();
    toast(`Odesláno ke kontrole (v${result.versionNo})`);
    setShared({ titles: [result.title], shareUrl: result.shareUrl });
  }

  async function pause(action: 'postpone' | 'cancel') {
    if (!reason.trim()) return setError('Napiš důvod.');
    const result = await perform(lifecycleAction({ videoId, action, reason: reason.trim() }));
    if (!result) return;
    close();
    toast(action === 'postpone' ? 'Scénář odložen' : 'Scénář zrušen');
    router.refresh();
  }

  const secondary = actions.withdraw || actions.unlock || actions.pause || actions.restore || actions.duplicate || actions.delete;
  const item = 'w-full justify-start';
  const menuItems = (
    <div role="menu" className="flex flex-col items-stretch gap-1">
      {actions.restore && (
        <Button
          variant="ghost"
          role="menuitem"
          className={item}
          pending={busy}
          onClick={async () => {
            if (await perform(lifecycleAction({ videoId, action: 'restore' }))) {
              setMenuOpen(false);
              toast('Scénář obnoven');
              router.refresh();
            }
          }}
        >
          <RotateCcw aria-hidden className="size-4" />
          Obnovit
        </Button>
      )}
      {actions.duplicate && (
        <Button
          variant="ghost"
          role="menuitem"
          className={item}
          pending={busy}
          onClick={async () => {
            const result = await perform(duplicateEpisodeAction({ videoId }));
            if (result) {
              setMenuOpen(false);
              toast('Další díl série vytvořen');
              router.push(`/scenare/${result.code}/upravit`);
            }
          }}
        >
          <CopyPlus aria-hidden className="size-4" />
          Duplikovat jako nový díl série
        </Button>
      )}
      {actions.unlock && (
        <Button
          variant="ghost"
          role="menuitem"
          className={item}
          pending={busy}
          onClick={async () => {
            if (await perform(unlockScriptAction({ videoId }))) router.push(`/scenare/${code}/upravit`);
          }}
        >
          <Lock aria-hidden className="size-4" />
          Odemknout pro úpravu
        </Button>
      )}
      {actions.withdraw && (
        <Button variant="ghost" role="menuitem" className={item} onClick={() => { setMenuOpen(false); setDialog('withdraw'); }}>
          <Undo2 aria-hidden className="size-4" />
          Stáhnout z kontroly
        </Button>
      )}
      {actions.pause && (
        <>
          <Button variant="ghost" role="menuitem" className={item} onClick={() => { setMenuOpen(false); setDialog('postpone'); }}>
            Odložit
          </Button>
          <Button variant="ghost" role="menuitem" className={`${item} text-danger-text`} onClick={() => { setMenuOpen(false); setDialog('cancel'); }}>
            Zrušit scénář
          </Button>
        </>
      )}
      {actions.delete && (
        <Button variant="danger" role="menuitem" className={item} onClick={() => { setMenuOpen(false); setDialog('delete'); }}>
          <Trash2 aria-hidden className="size-4" />
          Smazat scénář
        </Button>
      )}
    </div>
  );

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      {actions.edit && (
        <ButtonLink href={`/scenare/${code}/upravit`} variant="primary">
          <Pencil aria-hidden className="size-4" />
          {actions.withdraw ? 'Upravit (scénář je v kontrole)' : 'Upravit'}
        </ButtonLink>
      )}
      {actions.unlock && (
        <Button
          variant="primary"
          pending={busy}
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
          pending={busy}
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
        <>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex min-h-12 items-center gap-2 rounded-pill border border-ink/15 bg-card px-5 font-semibold select-none hover:bg-nest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet"
          >
            <MoreHorizontal aria-hidden className="size-5" />
            Další akce
          </button>
          {menuOpen && (
            <div className="hidden lg:block">
              <div aria-hidden className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
              <div className="absolute z-30 mt-14 w-72 rounded-inner bg-card p-2 shadow-[0_12px_40px_rgba(23,21,31,0.18)]">{menuItems}</div>
            </div>
          )}
          <div className="lg:hidden">
            <BottomSheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Další akce">
              {menuItems}
            </BottomSheet>
          </div>
        </>
      )}
      <ReviewDialog open={dialog === 'withdraw'} onClose={close} title={`Stáhnout ${code} z kontroly?`}>
        <p className="text-text2">Stáhnout {code} z kontroly? Honza a Radek ho přestanou vidět ke kontrole, dokud ho znovu neodešleš.</p>
        {error && (
          <p role="alert" className="mt-3 rounded-inner bg-danger-bg px-4 py-3 font-semibold text-danger-text">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={close} pending={busy}>
            Zpět
          </Button>
          <Button
            variant="primary"
            pending={busy}
            onClick={async () => {
              if (await perform(withdrawScriptAction({ videoId }))) {
                close();
                toast(`Scénář ${code} stažen z kontroly`);
                router.refresh();
              }
            }}
          >
            Stáhnout z kontroly
          </Button>
        </div>
      </ReviewDialog>
      <ReviewDialog open={dialog === 'delete'} onClose={close} title={`Smazat ${code}?`}>
        <p className="text-text2">Scénář, jeho verze i komentáře se smažou natrvalo.</p>
        {error && (
          <p role="alert" className="mt-3 rounded-inner bg-danger-bg px-4 py-3 font-semibold text-danger-text">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={close} pending={busy}>
            Zpět
          </Button>
          <Button
            variant="danger"
            pending={busy}
            onClick={async () => {
              if (await perform(deleteScriptAction({ videoId }))) {
                close();
                toast(`Scénář ${code} smazán`);
                router.push('/scenare');
              }
            }}
          >
            Smazat
          </Button>
        </div>
      </ReviewDialog>

      <SubmitDialog
        open={dialog === 'submit'}
        busy={busy}
        error={error}
        warnings={warnings}
        missing={missing}
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
            <Button variant="outline" onClick={close} pending={busy}>
              Zpět
            </Button>
            <Button type="submit" variant={dialog === 'cancel' ? 'danger' : 'primary'} pending={busy}>
              {dialog === 'cancel' ? 'Zrušit scénář' : 'Odložit'}
            </Button>
          </div>
        </form>
      </ReviewDialog>
      <ShareReviewDialog
        open={shared !== null}
        titles={shared?.titles ?? []}
        shareUrl={shared?.shareUrl ?? null}
        onClose={() => {
          setShared(null);
          router.refresh();
        }}
      />
    </div>
  );
}
