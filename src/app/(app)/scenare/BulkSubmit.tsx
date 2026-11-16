'use client';

import { useRouter } from 'next/navigation';
import { createContext, useContext, useState, useTransition, type ReactNode } from 'react';
import { Button } from '@/ui/Button';
import { ShareReviewCard } from '../_components/ShareReview';
import { useReviewToast } from '../_components/review/ReviewToast';
import { ReviewDialog } from '../_components/review/ReviewDialog';
import { moveToShootingDayAction, bulkDeleteAction, bulkSubmitAction, bulkWithdrawAction } from './actions';

const Ctx = createContext<{ selected: Map<string, string>; toggle: (id: string, status: string) => void } | null>(null);

/** Checkbox of one script row (only for scripts that can be sent). */
export function RowCheck({ id, label, status }: { id: string; label: string; status: string }) {
  const ctx = useContext(Ctx);
  if (!ctx) return null;
  return (
    <input
      type="checkbox"
      aria-label={`Vybrat ${label}`}
      checked={ctx.selected.has(id)}
      onChange={() => ctx.toggle(id, status)}
      className="relative z-10 size-5"
    />
  );
}

/** Selection state, sticky „Odeslat ke kontrole (N)“ bar and the „Dej vědět“ card afterwards. */
export function BulkSubmitProvider({ children, days = [] }: { children: ReactNode; /** Upcoming shooting days for „Přesunout na natáčecí den“. */ days?: { id: string; label: string }[] }) {
  const router = useRouter();
  const toast = useReviewToast();
  const [selected, setSelected] = useState<Map<string, string>>(new Map());
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState<string[]>([]);
  const [shared, setShared] = useState<{ titles: string[]; shareUrl: string | null } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toggle = (id: string, status: string) =>
    setSelected((cur) => {
      const next = new Map(cur);
      if (!next.delete(id)) next.set(id, status);
      return next;
    });
  const sendIds = [...selected].filter(([, st]) => st === 'draft' || st === 'returned').map(([id]) => id);
  const withdrawIds = [...selected].filter(([, st]) => st === 'in_review' || st === 'final_review').map(([id]) => id);
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [target, setTarget] = useState('');

  const move = () =>
    start(async () => {
      const result = await moveToShootingDayAction({ videoIds: [...selected.keys()], cycleId: target || null });
      setMoveOpen(false);
      if (!result.ok) return toast(result.message, 'error');
      setSelected(new Map());
      toast(`Přesunuto scénářů: ${selected.size}`);
      router.refresh();
    });

  const withdraw = () =>
    start(async () => {
      const result = await bulkWithdrawAction({ videoIds: withdrawIds });
      setConfirmWithdraw(false);
      if (!result.ok) return toast(result.message, 'error');
      setFailed(result.failed);
      setSelected(new Map());
      toast(`Staženo z kontroly: ${result.withdrawn}`);
      router.refresh();
    });

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
            {withdrawIds.length > 0 && (
              <Button variant="outline" disabled={pending} onClick={() => setConfirmWithdraw(true)}>
                Stáhnout z kontroly ({withdrawIds.length})
              </Button>
            )}
            {(
              <Button variant="outline" disabled={pending} onClick={() => setMoveOpen(true)}>
                Přesunout na natáčecí den ({selected.size})
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
      <ReviewDialog open={moveOpen} onClose={() => setMoveOpen(false)} title={`Přesunout na natáčecí den (${selected.size})`}>
        <label htmlFor="move-day" className="font-semibold">
          Natáčecí den
        </label>
        <select id="move-day" value={target} onChange={(e) => setTarget(e.target.value)} className="mt-2 w-full rounded-inner bg-nest p-4 text-base">
          <option value="">Bez natáčecího dne</option>
          {days.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setMoveOpen(false)} pending={pending}>
            Zpět
          </Button>
          <Button variant="primary" onClick={move} pending={pending}>
            Přesunout
          </Button>
        </div>
      </ReviewDialog>
      <ReviewDialog
        open={confirmWithdraw}
        onClose={() => setConfirmWithdraw(false)}
        title={`Stáhnout z kontroly (${withdrawIds.length})?`}
      >
        <p className="text-text2">Honza a Radek je přestanou vidět ke kontrole, dokud je znovu neodešleš.</p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setConfirmWithdraw(false)} pending={pending}>
            Zpět
          </Button>
          <Button variant="primary" onClick={withdraw} pending={pending}>
            Stáhnout z kontroly
          </Button>
        </div>
      </ReviewDialog>
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
