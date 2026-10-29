'use client';

import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { APPROVAL_STATUSES, APPROVAL_STATUS_LABELS } from '@/domain/workflow/approval';
import { PRODUCTION_STATUSES, PRODUCTION_STATUS_LABELS } from '@/domain/workflow/production';
import type { EditorOptions } from '@/server/editorOptions';
import { Button } from '@/ui/Button';
import { cn, focusRing } from '@/ui/cn';
import { Select } from '@/ui/Field';
import { monthLabel, monthsAround } from '@/ui/monthParams';
import { useShell } from '@/ui/ShellContext';
import { toListHref, type ListQuery } from './listModel';

const SEARCH_DELAY_MS = 350;

/** Filter bar of the script list: every control writes to the URL, the server page does the filtering. */
export function ListFilters({
  query,
  options,
  children,
}: {
  query: ListQuery;
  options: Pick<EditorOptions, 'cycles' | 'categories' | 'series'>;
  /** Primary action (new script); sits beside the search field on desktop. */
  children?: ReactNode;
}) {
  const router = useRouter();
  const { currentMonth } = useShell();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(query.q ?? '');
  const latest = useRef(query);
  useEffect(() => {
    latest.current = query;
  });

  // Typing searches after a short pause.
  useEffect(() => {
    if (text.trim() === (latest.current.q ?? '')) return;
    const timer = setTimeout(() => router.replace(toListHref({ ...latest.current, q: text.trim() || undefined })), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text, router]);

  const months = monthsAround(currentMonth);
  if (query.mesic && !months.includes(query.mesic)) months.push(query.mesic);

  const set = (key: keyof ListQuery) => (value: string) => router.replace(toListHref({ ...query, [key]: value || undefined }));
  const active = Object.keys(query).length;

  const select = (key: keyof ListQuery, label: string, all: string, items: { value: string; label: string }[]) => (
    <Select aria-label={label} value={query[key] ?? ''} onChange={(event) => set(key)(event.target.value)} pill>
      <option value="">{all}</option>
      {items.map((item) => (
        <option key={item.value} value={item.value}>
          {item.label}
        </option>
      ))}
    </Select>
  );

  return (
    <section aria-label="Filtry scénářů" className="flex flex-col gap-3 rounded-card bg-card p-4 md:p-5">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-text2" />
          <input
            type="search"
            aria-label="Hledat scénář"
            placeholder="Hledat podle kódu nebo názvu"
            value={text}
            onChange={(event) => setText(event.target.value)}
            className={cn('min-h-12 w-full rounded-pill bg-nest pr-4 pl-12 text-ink placeholder:text-text2/70', focusRing)}
          />
        </div>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={cn('inline-flex min-h-12 shrink-0 items-center gap-2 rounded-pill bg-nest px-4 font-semibold lg:hidden', focusRing)}
        >
          <SlidersHorizontal aria-hidden className="size-5" />
          Filtry{active > 0 ? ` · ${active}` : ''}
        </button>
        {children && <div className="hidden shrink-0 lg:block">{children}</div>}
      </div>
      <div className={cn('grid-cols-2 gap-2 md:grid-cols-3 lg:grid lg:grid-cols-6', open ? 'grid' : 'hidden')}>
        {select('cyklus', 'Cyklus', 'Všechny cykly', options.cycles.map((c) => ({ value: c.key, label: c.label })))}
        {select('mesic', 'Měsíc', 'Všechny měsíce', months.map((m) => ({ value: m, label: monthLabel(m) })))}
        {select('kategorie', 'Kategorie', 'Všechny kategorie', options.categories.map((c) => ({ value: c.key, label: c.short })))}
        {select('stav', 'Stav schválení', 'Každý stav', APPROVAL_STATUSES.map((s) => ({ value: s, label: APPROVAL_STATUS_LABELS[s] })))}
        {select('vyroba', 'Stav výroby', 'Každá výroba', PRODUCTION_STATUSES.map((s) => ({ value: s, label: PRODUCTION_STATUS_LABELS[s] })))}
        {select('serie', 'Série', 'Všechny série', options.series.map((s) => ({ value: s.key, label: s.label })))}
      </div>
      {active > 0 && (
        <div>
          <Button
            variant="ghost"
            className="min-h-12"
            onClick={() => {
              setText('');
              router.replace('/scenare');
            }}
          >
            <X aria-hidden className="size-4" />
            Zrušit filtry
          </Button>
        </div>
      )}
    </section>
  );
}
