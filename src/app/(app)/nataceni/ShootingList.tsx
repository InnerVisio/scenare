'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { LocationGroup } from '@/domain/shooting/plan';
import { PRODUCTION_STATUS_LABELS, type ProductionStatus } from '@/domain/workflow/production';
import { Button } from '@/ui/Button';
import { Card, CardTitle } from '@/ui/Card';
import { TextInput } from '@/ui/Field';
import { cn, focusRing } from '@/ui/cn';
import { setProductionStatusAction } from './actions';

/** Approved scripts by location → cast; an admin ticks scripts and marks them „Natočeno“ / „Nenatočeno“. */
export function ShootingList({
  groups,
  formatLabels,
  canMark,
  defaultDate,
}: {
  groups: LocationGroup[];
  formatLabels: Record<string, string>;
  canMark: boolean;
  defaultDate: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [date, setDate] = useState(defaultDate ?? '');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  function mark(status: 'shot' | 'not_shot') {
    if (selected.size === 0) {
      setMessage({ ok: false, text: 'Nejdřív zaškrtni scénáře, které chceš označit.' });
      return;
    }
    start(async () => {
      const result = await setProductionStatusAction({ videoIds: [...selected], status, shotDate: status === 'shot' && date ? date : null });
      if (result.ok) {
        setMessage({ ok: true, text: `Označeno: ${PRODUCTION_STATUS_LABELS[status]} (${selected.size}).` });
        setSelected(new Set());
        router.refresh();
      } else {
        setMessage({ ok: false, text: result.message });
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {canMark && (
        <Card className="flex flex-col gap-3">
          <CardTitle>Po natáčení</CardTitle>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-text2">
              Datum natáčení
              <TextInput type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <Button pending={pending} onClick={() => mark('shot')}>
              Natočeno
            </Button>
            <Button variant="outline" pending={pending} onClick={() => mark('not_shot')}>
              Nenatočeno
            </Button>
          </div>
          <p className="text-sm text-text2">Vybráno: {selected.size}</p>
          {message && (
            <p role={message.ok ? 'status' : 'alert'} className={cn('text-sm font-semibold', message.ok ? 'text-text2' : 'text-danger-text')}>
              {message.text}
            </p>
          )}
        </Card>
      )}
      {groups.map((group) => (
        <section key={group.key ?? 'none'} aria-label={group.label} className="flex flex-col gap-3">
          <h2 className="text-h2 px-1">
            {group.label} <span className="text-text2">({group.count})</span>
          </h2>
          {group.castGroups.map((cast) => (
            <Card key={cast.label} className="flex flex-col gap-3">
              <CardTitle>{cast.label}</CardTitle>
              <ul className="flex flex-col gap-2">
                {cast.items.map((item) => (
                  <li key={item.id} className="flex items-start gap-2 rounded-inner bg-nest px-3 py-2">
                    {canMark && (
                      <input
                        type="checkbox"
                        className="mt-3 size-6 shrink-0 accent-ink"
                        aria-label={`Vybrat ${item.code}`}
                        checked={selected.has(item.id)}
                        onChange={() => toggle(item.id)}
                      />
                    )}
                    <Link href={`/scenare/${item.code}`} className={cn('flex min-h-12 min-w-0 flex-1 flex-col justify-center gap-0.5 rounded-inner', focusRing)}>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-semibold text-text2">{item.code}</span>
                        <span className="font-semibold">{item.title}</span>
                      </span>
                      <span className="text-sm text-text2">
                        {item.hooks.length > 0 ? `Háčky: ${item.hooks.join(', ')}` : 'Bez háčků'}
                        {item.formatKey ? ` · ${formatLabels[item.formatKey] ?? item.formatKey}` : ''}
                        {item.props ? ` · Rekvizity: ${item.props}` : ''}
                        {' · '}
                        {PRODUCTION_STATUS_LABELS[item.productionStatus as ProductionStatus] ?? item.productionStatus}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </section>
      ))}
    </div>
  );
}
