'use client';

import { Bell, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { logout } from '@/app/login/actions';
import { Avatar } from './Avatar';
import { cn, focusRing } from './cn';
import { useShell } from './ShellContext';

const monthFormatter = new Intl.DateTimeFormat('cs-CZ', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number);
  const text = monthFormatter.format(new Date(Date.UTC(year, m - 1, 15)));
  return text.charAt(0).toLocaleUpperCase('cs') + text.slice(1);
}

export const cycleLabel = (id: string) => `Cyklus ${id.replace('-', '–')}`;

/** `current` ± `radius` months, as `YYYY-MM`. */
export function monthsAround(current: string, radius = 6): string[] {
  const [year, m] = current.split('-').map(Number);
  return Array.from({ length: radius * 2 + 1 }, (_, i) => {
    const d = new Date(Date.UTC(year, m - 1 + i - radius, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

const POPOVER =
  'absolute top-[calc(100%+8px)] z-40 max-h-72 w-56 overflow-y-auto rounded-inner bg-card p-2 shadow-[0_12px_40px_rgba(23,21,31,0.18)]';

function Segment({
  label,
  options,
  value,
  onSelect,
  align,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onSelect: (value: string) => void;
  align: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  const current = options.find((o) => o.value === value);
  return (
    <div ref={ref} className="relative flex-1 md:flex-none">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex min-h-12 w-full items-center justify-center rounded-pill px-4 text-sm font-semibold whitespace-nowrap md:px-5 md:text-base',
          focusRing,
          align === 'left' ? 'bg-card shadow-sm' : 'text-ink',
        )}
      >
        <span className="sr-only">{label}: </span>
        {current?.label ?? '–'}
      </button>
      {open && (
        <ul role="listbox" aria-label={label} className={cn(POPOVER, align === 'left' ? 'left-0' : 'right-0')}>
          {options.map((option) => (
            <li key={option.value} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => {
                  setOpen(false);
                  onSelect(option.value);
                }}
                className={cn(
                  'flex min-h-12 w-full items-center rounded-xl px-3 text-left text-sm font-semibold',
                  focusRing,
                  option.value === value ? 'bg-ink text-card' : 'hover:bg-nest',
                )}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UserMenu() {
  const shell = useShell();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Účet: ${shell.user.name}`}
        onClick={() => setOpen((v) => !v)}
        className={cn('flex size-12 items-center justify-center rounded-full', focusRing)}
      >
        <Avatar initials={shell.user.initials} size="lg" />
      </button>
      {open && (
        <div role="menu" className={cn(POPOVER, 'right-0 w-60 max-h-none')}>
          <div className="px-3 py-2">
            <p className="font-semibold">{shell.user.name}</p>
            <p className="text-sm text-text2">{shell.user.roleLabel}</p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              role="menuitem"
              className={cn('flex min-h-12 w-full items-center rounded-xl px-3 text-left font-semibold hover:bg-nest', focusRing)}
            >
              Odhlásit se
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

const ICON_BUTTON = cn('relative flex size-12 shrink-0 items-center justify-center rounded-full bg-card', focusRing);

export function TopBar({
  title,
  subtitle,
  size = 'h1',
}: {
  title: string;
  subtitle?: string;
  /** `display` (48 px) is for the greeting on the dashboard. */
  size?: 'h1' | 'display';
}) {
  const shell = useShell();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const month = params.get('mesic') ?? shell.currentMonth;
  const cycle = params.get('cyklus') ?? shell.defaultCycleId;

  const months = monthsAround(shell.currentMonth);
  if (!months.includes(month)) months.push(month);
  const cycleIds = cycle && !shell.cycleIds.includes(cycle) ? [...shell.cycleIds, cycle] : shell.cycleIds;

  function update(key: 'mesic' | 'cyklus', value: string) {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-4 pb-4 md:pb-6">
      <div className="min-w-0 flex-1 md:basis-80">
        <h1 className={cn('leading-tight font-semibold', size === 'display' ? 'text-h1 md:text-display' : 'text-h1')}>{title}</h1>
        {subtitle && <p className="mt-1 text-text2">{subtitle}</p>}
      </div>

      <div className="order-3 flex w-full items-center gap-1 rounded-pill bg-ink/[0.06] p-1 md:order-none md:w-auto">
        <Segment
          label="Měsíc"
          align="left"
          value={month}
          options={months.map((m) => ({ value: m, label: monthLabel(m) }))}
          onSelect={(v) => update('mesic', v)}
        />
        <Segment
          label="Cyklus"
          align="right"
          value={cycle ?? ''}
          options={cycleIds.map((id) => ({ value: id, label: cycleLabel(id) }))}
          onSelect={(v) => update('cyklus', v)}
        />
      </div>

      <div className="flex items-center gap-2">
        <Link href="/scenare" aria-label="Hledat" className={ICON_BUTTON}>
          <Search aria-hidden className="size-5" strokeWidth={1.75} />
        </Link>
        <Link
          href="/notifikace"
          aria-label={shell.unread > 0 ? `Upozornění, ${shell.unread} nepřečtených` : 'Upozornění'}
          className={ICON_BUTTON}
        >
          <Bell aria-hidden className="size-5" strokeWidth={1.75} />
          {shell.unread > 0 && <span aria-hidden className="absolute top-3 right-3 size-2.5 rounded-full bg-coral ring-2 ring-card" />}
        </Link>
        <UserMenu />
      </div>
    </header>
  );
}
