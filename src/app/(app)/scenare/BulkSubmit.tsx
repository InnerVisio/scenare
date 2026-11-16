'use client';

import { useRouter } from 'next/navigation';
import { createContext, useContext, useState, useTransition, type ReactNode } from 'react';
import { Button } from '@/ui/Button';
import { ShareReviewCard } from '../_components/ShareReview';
import { useReviewToast } from '../_components/review/ReviewToast';
import { bulkSubmitAction } from './actions';

const Ctx = createContext<{ selected: Set<string>; toggle: (id: string) => void } | null>(null);

/** Checkbox of one script row (only for scripts that can be sent). */
export function RowCheck({ id, label }: { id: string; label: string }) {
  const ctx = useContext(Ctx);
  if (!ctx) return null;
  return (
    <input
      type="checkbox"
      aria-label={`Vybrat ${label}`}
      checked={ctx.selected.has(id)}
      onChange={() => ctx.toggle(id)}
      className="relative z-10 size-5"
    />
  );
}

/** Selection state, sticky „Odeslat ke kontrole (N)“ bar and the „Dej vědět“ card afterwards. */
export function BulkSubmitProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const toast = useReviewToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState<string[]>([]);
  const [shared, setShared] = useState<{ titles: string[]; shareUrl: string | null } | null>(null);
  const toggle = (id: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const send = () =>
    start(async () => {
      const result = await bulkSubmitAction({ videoIds: [...selected] });
      if (!result.ok) return toast(result.message, 'error');
      setFailed(result.failed);
      setSelected(new Set());
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
        <div className="sticky bottom-4 z-20 flex items-center justify-between gap-3 rounded-card bg-ink p-4 text-white shadow-lg">
          <Button variant="primary" pending={pending} onClick={send}>
            Odeslat ke kontrole ({selected.size})
          </Button>
          <Button variant="outline" disabled={pending} onClick={() => setSelected(new Set())}>
            Zrušit výběr
          </Button>
        </div>
      )}
    </Ctx.Provider>
  );
}
