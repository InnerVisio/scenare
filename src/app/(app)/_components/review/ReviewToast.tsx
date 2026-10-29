'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/ui/cn';

type Tone = 'ok' | 'error';
interface ToastState {
  id: number;
  text: string;
  tone: Tone;
}

const ToastContext = createContext<((text: string, tone?: Tone) => void) | null>(null);

const SHOW_MS = { ok: 2000, error: 4500 } as const;

/** Lives in the `/kontrola` layout so a toast survives the move to the next script. */
export function ReviewToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const counter = useRef(0);

  const show = useCallback((text: string, tone: Tone = 'ok') => {
    counter.current += 1;
    setToast({ id: counter.current, text, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast((current) => (current?.id === toast.id ? null : current)), SHOW_MS[toast.tone]);
    return () => clearTimeout(timer);
  }, [toast]);

  const value = useMemo(() => show, [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-28 z-[70] flex justify-center px-4 lg:bottom-8"
      >
        {toast && (
          <p
            key={toast.id}
            className={cn(
              'max-w-md rounded-pill px-6 py-3.5 text-center font-semibold shadow-[0_12px_32px_rgba(23,21,31,0.3)]',
              toast.tone === 'ok' ? 'bg-ink text-lime' : 'bg-danger-bg text-danger-text',
            )}
          >
            {toast.text}
          </p>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useReviewToast(): (text: string, tone?: Tone) => void {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useReviewToast must be used inside <ReviewToastProvider>');
  return show;
}
