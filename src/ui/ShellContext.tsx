'use client';

import { createContext, useContext, type ReactNode } from 'react';

export interface ShellState {
  user: { name: string; initials: string; roleLabel: string };
  unread: number;
  cycleIds: string[];
  defaultCycleId: string | null;
  /** Current month in Prague, `YYYY-MM`. */
  currentMonth: string;
}

const ShellContext = createContext<ShellState | null>(null);

export function ShellProvider({ value, children }: { value: ShellState; children: ReactNode }) {
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellState {
  const value = useContext(ShellContext);
  if (!value) throw new Error('useShell must be used inside <ShellProvider>');
  return value;
}
