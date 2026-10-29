'use client';

import { Bell, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { logout } from '@/app/login/actions';
import { Avatar } from './Avatar';
import { cn, focusRing } from './cn';
import { cycleLabel, monthLabel, monthsAround, parseCycleParam, parseMonthParam } from './monthParams';
import { useShell } from './ShellContext';

/**
 * Disclosure popover behaviour: opens on the trigger, focus moves to the selected (or first) item,
 * Escape / outside click / selection closes it and focus goes back to the trigger.
 */
function useDisclosure() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });

  useEffect(() => {
    if (!open) return;
    const items = root.current?.querySelectorAll<HTMLElement>(`#${CSS.escape(panelId)} button`);
    const target = root.current?.querySelector<HTMLElement>(`#${CSS.escape(panelId)} [aria-current="true"]`) ?? items?.[0];
    target?.focus();
    const onPointer = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) closeRef.current();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, panelId]);

  return {
    open,
    root,
    trigger,
    panelId,
    close,
    toggle: () => (open ? close() : setOpen(true)),
    triggerProps: { 'aria-expanded': open, 'aria-controls': panelId } as const,
  };
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
  const menu = useDisclosure();
  const current = options.find((o) => o.value === value);
  return (
    <div ref={menu.root} className="relative flex-1 md:flex-none">
      <button
        ref={menu.trigger}
        type="button"
        {...menu.triggerProps}
        onClick={menu.toggle}
        className={cn(
          'flex min-h-12 w-full items-center justify-center rounded-pill px-4 text-sm font-semibold whitespace-nowrap md:px-5 md:text-base',
          focusRing,
          align === 'left' ? 'bg-card shadow-sm' : 'text-ink',
        )}
      >
        <span className="sr-only">{label}: </span>
        {current?.label ?? '–'}
      </button>
      {menu.open && (
        <ul id={menu.panelId} aria-label={label} className={cn(POPOVER, 'list-none', align === 'left' ? 'left-0' : 'right-0')}>
          {options.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                aria-current={option.value === value ? 'true' : undefined}
                onClick={() => {
                  menu.close();
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
  const menu = useDisclosure();
  return (
    <div ref={menu.root} className="relative">
      <button
        ref={menu.trigger}
        type="button"
        {...menu.triggerProps}
        aria-label={`Účet: ${shell.user.name}`}
        onClick={menu.toggle}
        className={cn('flex size-12 items-center justify-center rounded-full', focusRing)}
      >
        <Avatar initials={shell.user.initials} size="lg" />
      </button>
      {menu.open && (
        <div id={menu.panelId} className={cn(POPOVER, 'right-0 w-60 max-h-none')}>
          <div className="px-3 py-2">
            <p className="font-semibold">{shell.user.name}</p>
            <p className="text-sm text-text2">{shell.user.roleLabel}</p>
          </div>
          <form action={logout}>
            <button
              type="submit"
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

  const month = parseMonthParam(params.get('mesic'), shell.currentMonth);
  const cycle = parseCycleParam(params.get('cyklus'), shell.cycleIds, shell.defaultCycleId);

  const months = monthsAround(shell.currentMonth);
  if (!months.includes(month)) months.push(month);
  const cycleIds = shell.cycleIds;

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
