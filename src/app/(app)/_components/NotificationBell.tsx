'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { cn, focusRing } from '@/ui/cn';
import { useShell, type BellItem } from '@/ui/ShellContext';
import { markRead } from '../notifikace/actions';

/** One notification: navigates to its target and marks itself read in the background. */
export function NotificationLink({ item, onNavigate, className }: { item: BellItem; onNavigate?: () => void; className?: string }) {
  return (
    <Link
      href={item.href}
      onClick={() => {
        onNavigate?.();
        if (!item.read) void markRead(item.id);
      }}
      className={cn('flex min-h-12 items-start gap-3 rounded-xl px-3 py-3 hover:bg-nest', focusRing, className)}
    >
      <span aria-hidden className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', item.read ? 'bg-transparent' : 'bg-coral')} />
      <span className="min-w-0 flex-1">
        <span className={cn('block break-words', item.read ? 'text-text2' : 'font-semibold')}>
          {!item.read && <span className="sr-only">Nepřečtené: </span>}
          {item.text}
        </span>
        <span className="block text-sm text-text2">{item.when}</span>
      </span>
    </Link>
  );
}

export function NotificationBell() {
  const shell = useShell();
  const items = shell.notifications ?? [];
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-label={shell.unread > 0 ? `Upozornění, ${shell.unread} nepřečtených` : 'Upozornění'}
        onClick={() => setOpen(!open)}
        className={cn('relative flex size-12 shrink-0 items-center justify-center rounded-full bg-card', focusRing)}
      >
        <Bell aria-hidden className="size-5" strokeWidth={1.75} />
        {shell.unread > 0 && (
          <span
            aria-hidden
            className="absolute top-1 right-0 flex min-w-5 items-center justify-center rounded-full bg-coral px-1 text-xs leading-5 font-semibold text-ink ring-2 ring-lavender"
          >
            {shell.unread > 9 ? '9+' : shell.unread}
          </span>
        )}
      </button>
      {open && (
        <div
          role="region"
          aria-label="Poslední upozornění"
          className="fixed inset-x-4 top-20 z-40 max-h-[70vh] overflow-y-auto rounded-inner bg-card p-2 shadow-[0_12px_40px_rgba(23,21,31,0.18)] md:absolute md:inset-x-auto md:top-[calc(100%+8px)] md:right-0 md:w-96"
        >
          {items.length === 0 ? (
            <p className="px-3 py-4 text-text2">Zatím žádná upozornění.</p>
          ) : (
            <ul className="list-none">
              {items.map((item) => (
                <li key={item.id}>
                  <NotificationLink item={item} onNavigate={() => setOpen(false)} />
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/notifikace"
            onClick={() => setOpen(false)}
            className={cn('flex min-h-12 items-center rounded-xl px-3 font-semibold text-violet underline', focusRing)}
          >
            Všechna upozornění
          </Link>
        </div>
      )}
    </div>
  );
}
