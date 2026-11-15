'use client';

import { CircleHelp, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BottomSheet } from '@/ui/BottomSheet';
import { cn, focusRing } from '@/ui/cn';

const TIP_KEY = 'scenare.leadership.tipDismissed';

const LEGEND: { label: string; text: string; dot: string }[] = [
  { label: 'Čeká na tebe', text: 'Scénář čeká na tvoje schválení.', dot: 'bg-apricot-ink' },
  { label: 'Čeká na Radka / Honzu', text: 'Ty jsi schválil, čeká se na druhého.', dot: 'bg-violet-ink' },
  { label: 'Schváleno – točíme', text: 'Schválili jste oba, můžeme točit.', dot: 'bg-lime-dot' },
  { label: 'Admin upravuje', text: 'Vrátil jsi ho, Admin ho upraví podle poznámek.', dot: 'bg-grey-dot' },
  { label: 'Admin píše', text: 'Je to rozpracované, ještě není ke kontrole.', dot: 'bg-grey-dot' },
];

export function StatusLegend({ className }: { className?: string }) {
  return (
    <ul className={cn('flex flex-col gap-2', className)}>
      {LEGEND.map((item) => (
        <li key={item.label} className="flex items-start gap-3">
          <span aria-hidden className={cn('mt-2 size-3 shrink-0 rounded-full', item.dot)} />
          <span>
            <span className="font-semibold">{item.label}</span>
            <span className="text-text2"> – {item.text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function HelpButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Nápověda"
      className={cn('flex size-12 shrink-0 items-center justify-center rounded-full bg-card', focusRing, className)}
    >
      <CircleHelp aria-hidden className="size-5" />
    </button>
  );
}

export function HelpSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Jak kontrolovat">
      <ol className="flex list-decimal flex-col gap-3 pl-5 marker:font-semibold">
        <li>Přečti si scénář.</li>
        <li>Chceš něco změnit? Označ text prstem → „Komentovat“ nebo „Navrhnout změnu“.</li>
        <li>
          Hotovo? „Schválit“ = je to OK, můžeme točit. „Vrátit“ = Admin to upraví podle tvých poznámek.
        </li>
        <li>Scénář se točí, až ho schválíte oba.</li>
      </ol>
      <h3 className="mt-5 mb-2 text-h2">Co znamenají stavy?</h3>
      <StatusLegend />
    </BottomSheet>
  );
}

/** One-time tip for the first visit; dismissal is remembered in localStorage (which may be unavailable). */
export function FirstVisitTip() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(TIP_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);
  if (!visible) return null;
  return (
    <div role="note" className="flex items-center gap-2 rounded-inner bg-violet-soft py-1 pr-1 pl-3 text-sm">
      <p className="min-w-0 flex-1">Tip: Označ v textu slovo nebo větu a můžeš k ní napsat komentář.</p>
      <button
        type="button"
        onClick={() => {
          setVisible(false);
          try {
            localStorage.setItem(TIP_KEY, '1');
          } catch {
            /* remembering is optional */
          }
        }}
        className={cn('inline-flex min-h-11 items-center gap-1 rounded-pill bg-card px-3 font-semibold', focusRing)}
      >
        <X aria-hidden className="size-4" />
        Rozumím
      </button>
    </div>
  );
}
