'use client';

import { useId, useState } from 'react';
import { cn, focusRing } from './cn';

export interface TabItem {
  id: string;
  label: string;
}

/** Segmented control (v2 · aktuální / Změny od v1 …). Controlled via `value`, otherwise keeps its own state. */
export function Tabs({
  items,
  value,
  defaultValue,
  onChange,
  label,
  className,
}: {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  label: string;
  className?: string;
}) {
  const [inner, setInner] = useState(defaultValue ?? items[0]?.id);
  const current = value ?? inner;
  const group = useId();

  function select(id: string) {
    setInner(id);
    onChange?.(id);
  }

  return (
    <div role="tablist" aria-label={label} className={cn('inline-flex max-w-full gap-1 overflow-x-auto rounded-pill bg-nest p-1', className)}>
      {items.map((item) => {
        const active = item.id === current;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`${group}-${item.id}`}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => select(item.id)}
            onKeyDown={(event) => {
              const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
              if (!step) return;
              const next = items[(items.findIndex((i) => i.id === current) + step + items.length) % items.length];
              select(next.id);
              document.getElementById(`${group}-${next.id}`)?.focus();
            }}
            className={cn(
              'min-h-12 rounded-pill px-4 text-sm font-semibold whitespace-nowrap transition-colors',
              focusRing,
              active ? 'bg-ink text-card' : 'text-text2 hover:text-ink',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
