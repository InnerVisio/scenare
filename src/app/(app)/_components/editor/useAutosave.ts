'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

export type SaveOutcome = { ok: true } | { ok: false; message: string; retry: boolean };

export const RETRY_MESSAGE = 'Nepodařilo se uložit — zkusím znovu';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Debounced autosave of `value`. The first save runs `delayMs` after the last change; a failed save is
 * retried with exponential back-off (1 s, 2 s, 4 s) when `retry` is set, then waits for `retry()`.
 * `flush()` saves right now and resolves true once the server has the latest value.
 */
export function useAutosave<T>({
  value,
  initial,
  save,
  delayMs = 1500,
  maxRetries = 3,
}: {
  value: T;
  /** What the server already has. */
  initial: T;
  save: (value: T, saved: T) => Promise<SaveOutcome>;
  delayMs?: number;
  maxRetries?: number;
}) {
  const [state, setState] = useState<SaveState>('saved');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const savedRef = useRef(initial);
  const valueRef = useRef(value);
  const saveRef = useRef(save);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inflight = useRef<Promise<boolean> | null>(null);
  const attempts = useRef(0);
  const runRef = useRef<() => Promise<boolean>>(async () => true);

  const persist = useCallback(async (): Promise<boolean> => {
    for (;;) {
      const current = valueRef.current;
      if (same(current, savedRef.current)) {
        setState('saved');
        return true;
      }
      setState('saving');
      let outcome: SaveOutcome;
      try {
        outcome = await saveRef.current(current, savedRef.current);
      } catch {
        outcome = { ok: false, message: RETRY_MESSAGE, retry: true };
      }
      if (outcome.ok) {
        savedRef.current = current;
        attempts.current = 0;
        setSavedAt(new Date());
        setError(null);
        continue; // the value may have changed while saving
      }
      setError(outcome.message);
      setState('error');
      if (outcome.retry && attempts.current < maxRetries) {
        attempts.current += 1;
        timer.current = setTimeout(() => void runRef.current(), 1000 * 2 ** (attempts.current - 1));
      }
      return false;
    }
  }, [maxRetries]);

  const run = useCallback((): Promise<boolean> => {
    clearTimeout(timer.current);
    inflight.current ??= persist().finally(() => {
      inflight.current = null;
    });
    return inflight.current;
  }, [persist]);

  useEffect(() => {
    runRef.current = run;
    saveRef.current = save;
  });

  useEffect(() => {
    valueRef.current = value;
    if (same(value, savedRef.current)) return;
    setState((s) => (s === 'saving' ? s : 'dirty'));
    clearTimeout(timer.current);
    attempts.current = 0;
    timer.current = setTimeout(() => void runRef.current(), delayMs);
  }, [value, delayMs]);

  useEffect(() => () => clearTimeout(timer.current), []);

  /** The server's copy changed under us (for example after accepting a suggestion): treat `next` as saved. */
  const adopt = useCallback((next: T) => {
    savedRef.current = next;
    valueRef.current = next;
    setState('saved');
    setError(null);
  }, []);

  return {
    state,
    savedAt,
    error,
    flush: run,
    retry: () => {
      attempts.current = 0;
      void run();
    },
    adopt,
  };
}
