'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { cycleLabel } from '@/domain/format/date';
import { Button } from '@/ui/Button';
import { BottomSheet } from '@/ui/BottomSheet';
import { Field, Select, TextInput } from '@/ui/Field';
import { useShell } from '@/ui/ShellContext';
import { addShootingDayAction } from '../nastaveni/actions';

export interface CycleOption {
  key: string;
  label: string;
  date?: string | null;
}

const ADD = '__add__';
const pragueDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit' });

/** „Natáčecí den“ select: upcoming days, the current one, and (admin) a quick „+ Přidat natáčecí den…“ dialog. */
export function CycleSelect({
  value,
  onChange,
  cycles,
  label,
  empty = '—',
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  cycles: CycleOption[];
  label: string;
  empty?: string;
}) {
  const { admin } = useShell();
  const router = useRouter();
  const [added, setAdded] = useState<CycleOption[]>([]);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const today = pragueDay.format(new Date());

  const all = [...cycles, ...added.filter((a) => !cycles.some((c) => c.key === a.key))];
  const items = all.filter((c) => c.key === value || !c.date || c.date >= today);

  const save = () =>
    start(async () => {
      setError(null);
      const result = await addShootingDayAction({ shootDate: date });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const id = result.id;
      setAdded((prev) => [...prev, { key: id, label: cycleLabel({ id, shootDate: date }), date }]);
      onChange(id);
      setOpen(false);
      setDate('');
      router.refresh();
    });

  return (
    <>
      <Field label={label}>
        <Select
          value={value ?? ''}
          onChange={(event) => {
            if (event.target.value === ADD) {
              setOpen(true);
              return;
            }
            onChange(event.target.value || null);
          }}
        >
          <option value="">{empty}</option>
          {items.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
          {admin && <option value={ADD}>+ Přidat natáčecí den…</option>}
        </Select>
      </Field>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Přidat natáčecí den">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            save();
          }}
        >
          <Field label="Datum natáčení">
            <TextInput type="date" required min={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          {error && (
            <p role="alert" className="text-sm font-semibold text-danger-text">
              {error}
            </p>
          )}
          <Button type="submit" pending={pending} disabled={!date}>
            Přidat den
          </Button>
        </form>
      </BottomSheet>
    </>
  );
}
