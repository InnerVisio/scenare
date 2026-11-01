'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { SERIES_STATUSES, SERIES_STATUS_LABELS } from '@/domain/series/status';
import { Button } from '@/ui/Button';
import { Card, CardTitle } from '@/ui/Card';
import { Field, Select, TextInput, Textarea } from '@/ui/Field';
import { updateSeriesAction } from '../actions';

export interface SeriesFormValue {
  id: string;
  name: string;
  mainCategoryKey: string | null;
  goal: string;
  guarantorId: string | null;
  plannedEpisodes: number | null;
  scopeChangeReason: string;
  startDate: string | null;
  expectedEnd: string | null;
  note: string;
  status: string;
}

/** Admin-only form; a changed plan of episodes asks for „Důvod změny rozsahu“. */
export function SeriesEditForm({
  value,
  categories,
  guarantors,
}: {
  value: SeriesFormValue;
  categories: { key: string; label: string }[];
  guarantors: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState({ ...value, planned: value.plannedEpisodes?.toString() ?? '', reason: '' });
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const plannedNumber = form.planned.trim() === '' ? null : Number(form.planned);
  const scopeChanged = plannedNumber !== value.plannedEpisodes && value.plannedEpisodes != null;
  const statusOptions = SERIES_STATUSES.filter((x) => x !== 'closed' || value.status === 'closed');

  function save() {
    start(async () => {
      const result = await updateSeriesAction({
        seriesId: value.id,
        patch: {
          name: form.name,
          mainCategoryKey: form.mainCategoryKey || null,
          goal: form.goal,
          guarantorId: form.guarantorId || null,
          plannedEpisodes: plannedNumber != null && Number.isInteger(plannedNumber) ? plannedNumber : null,
          ...(scopeChanged ? { scopeChangeReason: form.reason } : {}),
          startDate: form.startDate || null,
          expectedEnd: form.expectedEnd || null,
          note: form.note,
          ...(form.status !== value.status ? { status: form.status } : {}),
        },
      });
      setStatus(result.ok ? { ok: true, text: 'Uloženo.' } : { ok: false, text: result.message });
      if (result.ok) router.refresh();
    });
  }

  return (
    <Card className="flex flex-col gap-4">
      <CardTitle>Údaje série</CardTitle>
      <Field label="Název">
        <TextInput value={form.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Hlavní kategorie">
          <Select value={form.mainCategoryKey ?? ''} onChange={(e) => set({ mainCategoryKey: e.target.value || null })}>
            <option value="">Bez kategorie</option>
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Garant (vedení)">
          <Select value={form.guarantorId ?? ''} onChange={(e) => set({ guarantorId: e.target.value || null })}>
            <option value="">Bez garanta</option>
            {guarantors.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Plánovaný počet dílů">
          <TextInput type="number" inputMode="numeric" min={1} max={200} value={form.planned} onChange={(e) => set({ planned: e.target.value })} />
        </Field>
        <Field label="Stav">
          <Select value={form.status} onChange={(e) => set({ status: e.target.value })}>
            {statusOptions.map((x) => (
              <option key={x} value={x}>
                {SERIES_STATUS_LABELS[x]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Začátek">
          <TextInput type="date" value={form.startDate ?? ''} onChange={(e) => set({ startDate: e.target.value || null })} />
        </Field>
        <Field label="Očekávaný konec">
          <TextInput type="date" value={form.expectedEnd ?? ''} onChange={(e) => set({ expectedEnd: e.target.value || null })} />
        </Field>
      </div>
      {scopeChanged && (
        <Field label="Důvod změny rozsahu" hint={`Původní plán: ${value.plannedEpisodes} dílů.`}>
          <TextInput value={form.reason} onChange={(e) => set({ reason: e.target.value })} />
        </Field>
      )}
      <Field label="Cíl série">
        <Textarea value={form.goal} onChange={(e) => set({ goal: e.target.value })} />
      </Field>
      <Field label="Poznámka">
        <Textarea value={form.note} onChange={(e) => set({ note: e.target.value })} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" pending={pending} onClick={save}>
          Uložit
        </Button>
        <p role="status" className={status && !status.ok ? 'font-semibold text-danger-text' : 'text-text2'}>
          {status?.text}
        </p>
      </div>
    </Card>
  );
}
