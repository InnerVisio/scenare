'use client';

import { useRouter } from 'next/navigation';
import { createContext, useContext, useState, useTransition, type ReactNode } from 'react';
import { Button } from '@/ui/Button';
import { ShareReviewCard } from '../_components/ShareReview';
import { useReviewToast } from '../_components/review/ReviewToast';
import { ReviewDialog } from '../_components/review/ReviewDialog';
import { bulkDeleteAction, bulkSubmitAction } from './actions';

const Ctx = createContext<{ selected: Map<string, boolean>; toggle: (id: string, sendable: boolean) => void } | null>(null);

/** Checkbox of one script row (only for scripts that can be sent). */
export function RowCheck({ id, label, sendable }: { id: string; label: string; sendable: boolean }) {
  const ctx = useContext(Ctx);
  if (!ctx) return null;
  return (
    <input
      type="checkbox"
      aria-label={`Vybrat ${label}`}
      checked={ctx.selected.has(id)}
      onChange={() => ctx.toggle(id, sendable)}
      className="relative z-10 size-5"
    />
  );
}

/** Selection state, sticky „Odeslat ke kontrole (N)“ bar and the „Dej vědět“ card afterwards. */
export function BulkSubmitProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const toast = useReviewToast();
  const [selected, setSelected] = useState<Map<string, boolean>>(new Map());
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState<string[]>([]);
  const [shared, setShared] = useState<{ titles: string[]; shareUrl: string | null } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toggle = (id: string, sendable: boolean) =>
    setSelected((cur) => {
      const next = new Map(cur);
      if (!next.delete(id)) next.set(id, sendable);
      return next;
    });
  const sendIds = [...selected].filter(([, ok]) => ok).map(([id]) => id);

  const remove = () =>
    start(async () => {
      const result = await bulkDeleteAction({ videoIds: [...selected.keys()] });
      setConfirmDelete(false);
      if (!result.ok) return toast(result.message, 'error');
      setFailed(result.failed);
      setSelected(new Map());
      toast(`Smazáno scénářů: ${result.deleted}`);
      router.refresh();
    });

  const send = () =>
    start(async () => {
      const result = await bulkSubmitAction({ videoIds: sendIds });
      if (!result.ok) return toast(result.message, 'error');
      setFailed(result.failed);
      setSelected(new Map());
      if (result.submitted.length > 0) {
        toast(`Odesláno ke kontrole: ${result.submitted.length}`);
        setShared({ titles: result.submitted.map((x) => x.title), shareUrl: result.shareUrl });
      }
      router.refresh();
    });

  return (
    <Ctx.Provider value={{ selected, toggle }}>
      {failed.length > 0 && (
        <div role="alert" className="rounded-inner bg-danger-bg p-4 text-danger-text">
          <ul className="flex list-disc flex-col gap-1 pl-5 font-semibold">
            {failed.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}
      {shared && <ShareReviewCard titles={shared.titles} shareUrl={shared.shareUrl} onClose={() => setShared(null)} />}
      {children}
      {selected.size > 0 && (
        <div className="sticky bottom-24 z-20 md:bottom-4 flex items-center justify-between gap-3 rounded-card bg-ink p-4 text-white shadow-lg">
          <div className="flex flex-wrap gap-2">
            {sendIds.length > 0 && (
              <Button variant="primary" pending={pending} onClick={send}>
                Odeslat ke kontrole ({sendIds.length})
              </Button>
            )}
            <Button variant="danger" disabled={pending} onClick={() => setConfirmDelete(true)}>
              Smazat ({selected.size})
            </Button>
          </div>
          <Button variant="outline" disabled={pending} onClick={() => setSelected(new Map())}>
            Zrušit výběr
          </Button>
        </div>
      )}
      <ReviewDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title={`Smazat ${selected.size} ${selected.size === 1 ? 'scénář' : 'scénářů'}?`}>
        <p className="text-text2">Scénáře, jejich verze i komentáře se smažou natrvalo.</p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setConfirmDelete(false)} pending={pending}>
            Zpět
          </Button>
          <Button variant="danger" onClick={remove} pending={pending}>
            Smazat
          </Button>
        </div>
      </ReviewDialog>
    </Ctx.Provider>
  );
}
