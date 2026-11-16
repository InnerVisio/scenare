'use client';

import { useMemo } from 'react';
import type { EditorOptions } from '@/server/editorOptions';
import type { EditorValues } from '@/server/scripts';
import { cn, focusRing } from '@/ui/cn';
import { Field, Select, TextInput, Textarea } from '@/ui/Field';
import { monthLabel, monthsAround } from '@/ui/monthParams';
import { CycleSelect } from '../CycleSelect';
import { ChipInput } from './ChipInput';
import { mixHints } from './mixHints';
import { addNames, applyFormat } from './reducers';

const GOALS = [
  { value: 'shares', label: 'Sdílení' },
  { value: 'saves', label: 'Uložení' },
  { value: 'comments', label: 'Komentáře' },
] as const;

const orNull = (value: string) => value || null;

function Options({ items, empty = '—', missing = {} }: { items: { key: string; label: string }[]; empty?: string; missing?: Record<string, number> }) {
  return (
    <>
      <option value="">{empty}</option>
      {items.map((item) => (
        <option key={item.key} value={item.key}>
          {item.label}
          {missing[item.key] ? ` (chybí ${missing[item.key]})` : ''}
        </option>
      ))}
    </>
  );
}

/** Název, kategorie, natáčecí den and profil: everything a script needs. */
export function MetaForm({ values, onChange, options }: { values: EditorValues; onChange: (patch: Partial<EditorValues>) => void; options: EditorOptions }) {
  const { cycleId, categoryKey, treatmentKey, profileKey, characterKey } = values;
  const hints = useMemo(
    () =>
      mixHints(options, {
        cycleId,
        categoryKey,
        treatmentKey,
        profileKey,
        characterKey,
      }),
    [options, cycleId, categoryKey, treatmentKey, profileKey, characterKey],
  );
  const titleMissing = values.title.trim() === '';

  return (
    <section aria-label="Údaje o videu" className="flex flex-col gap-4 rounded-card bg-card p-5 lg:p-6">
      <Field label="Název" error={titleMissing ? 'Zadej název scénáře, jinak se neuloží.' : undefined}>
        <TextInput value={values.title} onChange={(event) => onChange({ title: event.target.value })} maxLength={200} aria-invalid={titleMissing} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kategorie" hint={hints.category ?? undefined}>
          <Select value={values.categoryKey ?? ''} onChange={(event) => onChange({ categoryKey: orNull(event.target.value) })}>
            <Options items={options.categories} missing={hints.categoryMissing} />
          </Select>
        </Field>
        <CycleSelect label="Natáčecí den" value={values.cycleId} cycles={options.cycles} onChange={(id) => onChange({ cycleId: id })} />
        <Field label="Profil (nepovinné)">
          <Select value={values.profileKey ?? ''} onChange={(event) => onChange({ profileKey: orNull(event.target.value) })}>
            <Options items={options.profiles} />
          </Select>
        </Field>
      </div>
    </section>
  );
}

/** Everything optional about the video; rendered inside „Další údaje“. */
export function MetaExtras({
  values,
  onChange,
  options,
  currentMonth,
}: {
  values: EditorValues;
  onChange: (patch: Partial<EditorValues>) => void;
  options: EditorOptions;
  currentMonth: string;
}) {
  const months = monthsAround(currentMonth);
  if (values.plannedMonth && !months.includes(values.plannedMonth)) months.push(values.plannedMonth);

  const families = [...new Set(options.formats.map((f) => f.family))];
  const speakers = options.profiles.map((p) => p.speaker).filter((s): s is string => s !== null);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Typ zpracování">
        <Select value={values.treatmentKey ?? ''} onChange={(event) => onChange({ treatmentKey: orNull(event.target.value) })}>
          <Options items={options.treatments} />
        </Select>
      </Field>
      <Field label="Charakter">
        <Select value={values.characterKey ?? ''} onChange={(event) => onChange({ characterKey: orNull(event.target.value) })}>
          <Options items={options.characters} />
        </Select>
      </Field>
      <Field label="Plánovaný měsíc">
        <Select value={values.plannedMonth ?? ''} onChange={(event) => onChange({ plannedMonth: orNull(event.target.value) })}>
          <Options items={months.map((m) => ({ key: m, label: monthLabel(m) }))} />
        </Select>
      </Field>
      <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-3">
        <Field label="Série">
          <Select value={values.seriesId ?? ''} onChange={(event) => onChange({ seriesId: orNull(event.target.value) })}>
            <Options items={options.series} empty="Mimo sérii" />
          </Select>
        </Field>
        <Field label="Díl">
          <TextInput
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={values.episodeNo ?? ''}
            onChange={(event) =>
              onChange({
                episodeNo: event.target.value === '' ? null : Math.max(1, Math.round(Number(event.target.value))),
              })
            }
          />
        </Field>
      </div>
      <Field label="Cíl videa">
        <Select
          value={values.goalMetric ?? ''}
          onChange={(event) =>
            onChange({
              goalMetric: GOALS.find((g) => g.value === event.target.value)?.value ?? null,
            })
          }
        >
          <option value="">—</option>
          {GOALS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </Select>
      </Field>

      <div className="flex flex-col gap-2 sm:col-span-2">
        <Field label="Formát">
          <Select value={values.formatKey ?? ''} onChange={(event) => onChange(applyFormat(values, orNull(event.target.value), options.formats))}>
            <option value="">—</option>
            {families.map((family) => (
              <optgroup key={family} label={family}>
                {options.formats
                  .filter((f) => f.family === family)
                  .map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.status === 'verified' ? '✅' : '🧪'} {f.label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        <label className="flex min-h-12 items-center gap-3 font-semibold">
          <input
            type="checkbox"
            checked={values.isTrialReel}
            onChange={(event) => onChange({ isTrialReel: event.target.checked })}
            className={cn('size-6 accent-ink', focusRing)}
          />
          Trial Reel (nový formát zkusíme nejdřív na zkoušku)
        </label>
      </div>

      <fieldset className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
        <legend className="mb-1.5 text-sm font-semibold text-text2">Lokace</legend>
        <div className="flex flex-wrap gap-2">
          {options.locations.map((location) => {
            const on = values.locationKeys.includes(location.key);
            return (
              <button
                key={location.key}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  onChange({
                    locationKeys: on ? values.locationKeys.filter((k) => k !== location.key) : [...values.locationKeys, location.key],
                  })
                }
                className={cn('min-h-12 rounded-pill px-4 text-left font-semibold', focusRing, on ? 'bg-ink text-card' : 'bg-nest text-ink')}
              >
                {location.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="sm:col-span-2">
        <ChipInput
          label="Účinkující"
          tags={values.cast}
          onChange={(cast) => onChange({ cast })}
          add={addNames}
          splitOnSpace={false}
          suggestions={speakers}
          placeholder="Jméno a Enter, např. Radek"
        />
      </div>
      <Field label="Rekvizity" className="sm:col-span-2">
        <Textarea value={values.props} onChange={(event) => onChange({ props: event.target.value })} maxLength={1000} />
      </Field>
      <Field label="Záměr" className="sm:col-span-2">
        <Textarea value={values.intent} onChange={(event) => onChange({ intent: event.target.value })} maxLength={1000} />
      </Field>
      <Field label="Hlavní myšlenka" className="sm:col-span-2">
        <Textarea value={values.mainIdea} onChange={(event) => onChange({ mainIdea: event.target.value })} maxLength={1000} />
      </Field>
    </div>
  );
}
