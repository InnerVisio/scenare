'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { durationSec } from '@/domain/script/metrics';
import type { ImportMeta } from '@/domain/script/import';
import type { ScriptBody } from '@/domain/script/types';
import type { EditorOptions } from '@/server/editorOptions';
import { Button } from '@/ui/Button';
import { Field, Select, TextInput, Textarea } from '@/ui/Field';
import { useShell } from '@/ui/ShellContext';
import { ScriptView, type ScriptMeta } from '../../_components/script-view/ScriptView';
import { createScriptAction, importScriptsAction, parseScriptsAction } from '../actions';

interface Item {
  body: ScriptBody;
  meta: ImportMeta;
  warnings: string[];
}

const GOALS = [
  { value: 'shares', label: 'Sdílení' },
  { value: 'saves', label: 'Uložení' },
  { value: 'comments', label: 'Komentáře' },
] as const;

const FALLBACK_TAG = { key: '', label: 'Bez kategorie', colors: { color: '#F4F3FA', textColor: '#17151F' } };

function viewMeta(item: Item, options: EditorOptions): ScriptMeta {
  const category = options.categories.find((c) => c.key === item.meta.categoryKey);
  return {
    code: 'NOVÝ',
    versionNo: 1,
    title: item.meta.title || 'Bez názvu',
    categoryTag: category ? { key: category.key, label: category.label, colors: { color: category.color, textColor: category.textColor } } : FALLBACK_TAG,
    isTrialReel: false,
    durationSec: durationSec(item.body),
    profileLabel: options.profiles.find((p) => p.key === item.meta.profileKey)?.label,
    locationLabels: [],
  };
}

function Opts({ items }: { items: { key: string; label: string }[] }) {
  return (
    <>
      <option value="">—</option>
      {items.map((i) => (
        <option key={i.key} value={i.key}>
          {i.label}
        </option>
      ))}
    </>
  );
}

/** „Vložit scénář“: paste the text, check the split, save the drafts. */
export function ImportForm({ options, cycleId, plannedMonth }: { options: EditorOptions; cycleId: string | null; plannedMonth: string | null }) {
  const router = useRouter();
  const { currentMonth } = useShell();
  const [pending, start] = useTransition();
  const [text, setText] = useState('');
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nextCycle = options.cycles.find((c) => c.key >= currentMonth) ?? options.cycles[options.cycles.length - 1];
  const [cycle, setCycle] = useState<string>(cycleId ?? nextCycle?.key ?? '');

  const split = () =>
    start(async () => {
      setError(null);
      const result = await parseScriptsAction({ text });
      if (!result.ok) return setError(result.message);
      setItems(result.scripts);
    });

  const save = () =>
    start(async () => {
      setError(null);
      const result = await importScriptsAction({
        cycleId: cycle || null,
        plannedMonth,
        scripts: (items ?? []).map(({ body, meta }) => ({ body, meta: { ...meta, title: meta.title.trim() || 'Nový scénář' } })),
      });
      if (!result.ok) return setError(result.message);
      router.push(result.codes.length === 1 ? `/scenare/${result.codes[0]}/upravit` : '/scenare');
    });

  const manual = () =>
    start(async () => {
      try {
        await createScriptAction({ cycleId, plannedMonth });
      } catch (e) {
        // `redirect` throws by design; anything else is shown.
        if (e instanceof Error && !e.message.includes('NEXT_REDIRECT')) setError(e.message);
        else throw e;
      }
    });

  const patch = (index: number, change: Partial<ImportMeta>) =>
    setItems((list) => (list ?? []).map((it, i) => (i === index ? { ...it, meta: { ...it.meta, ...change } } : it)));

  const errorBox = error && (
    <p role="alert" className="rounded-inner bg-danger-bg p-4 font-semibold text-danger-text">
      {error}
    </p>
  );

  if (!items) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-h1">Nový scénář</h1>
        <section className="flex flex-col gap-4 rounded-card bg-card p-5 lg:p-6">
          <Field label="Vlož celý text scénáře (jak ho máš — Word, poznámky, WhatsApp)" hint="Víc scénářů najednou? Odděl je čárou --- nebo je očísluj (1. Název).">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-80" maxLength={20000} />
          </Field>
          {errorBox}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" pending={pending} disabled={pending || text.trim().length < 20} onClick={split}>
              Rozdělit scénář
            </Button>
            <Button variant="ghost" disabled={pending} onClick={manual}>
              Vyplnit ručně
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-h1">{items.length === 1 ? 'Zkontroluj scénář' : `Zkontroluj scénáře (${items.length})`}</h1>
      <section aria-label="Společné údaje" className="rounded-card bg-card p-5 lg:p-6">
        <Field label="Cyklus natáčení (pro všechny)">
          <Select value={cycle} onChange={(e) => setCycle(e.target.value)}>
            <Opts items={options.cycles} />
          </Select>
        </Field>
      </section>
      {items.map((item, index) => (
        <details key={index} open={items.length === 1} className="rounded-card bg-card p-5 lg:p-6">
          <summary className="cursor-pointer text-h2">
            {index + 1}. {item.meta.title || 'Bez názvu'}
          </summary>
          <div className="mt-4 flex flex-col gap-4">
            {item.warnings.length > 0 && (
              <div className="rounded-inner bg-apricot-soft p-4 text-apricot-ink">
                <ul className="flex list-disc flex-col gap-1 pl-5">
                  {item.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Název" className="sm:col-span-2">
                <TextInput value={item.meta.title} maxLength={200} onChange={(e) => patch(index, { title: e.target.value })} />
              </Field>
              <Field label="Kategorie">
                <Select value={item.meta.categoryKey ?? ''} onChange={(e) => patch(index, { categoryKey: e.target.value || null })}>
                  <Opts items={options.categories} />
                </Select>
              </Field>
              <Field label="Typ zpracování">
                <Select value={item.meta.treatmentKey ?? ''} onChange={(e) => patch(index, { treatmentKey: e.target.value || null })}>
                  <Opts items={options.treatments} />
                </Select>
              </Field>
              <Field label="Profil">
                <Select value={item.meta.profileKey ?? ''} onChange={(e) => patch(index, { profileKey: e.target.value || null })}>
                  <Opts items={options.profiles} />
                </Select>
              </Field>
              <Field label="Charakter">
                <Select value={item.meta.characterKey ?? ''} onChange={(e) => patch(index, { characterKey: e.target.value || null })}>
                  <Opts items={options.characters} />
                </Select>
              </Field>
              <Field label="Formát">
                <Select value={item.meta.formatKey ?? ''} onChange={(e) => patch(index, { formatKey: e.target.value || null })}>
                  <Opts items={options.formats} />
                </Select>
              </Field>
              <Field label="Cíl">
                <Select value={item.meta.goalMetric ?? ''} onChange={(e) => patch(index, { goalMetric: (e.target.value || null) as ImportMeta['goalMetric'] })}>
                  <option value="">—</option>
                  {GOALS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <ScriptView body={item.body} meta={viewMeta(item, options)} mode="read" threads={[]} hookTypeLabels={{}} />
          </div>
        </details>
      ))}
      {errorBox}
      <div className="flex flex-wrap gap-3">
        <Button variant="primary" pending={pending} disabled={pending} onClick={save}>
          {items.length === 1 ? 'Uložit a otevřít editor' : `Uložit všechny (${items.length})`}
        </Button>
        <Button variant="outline" disabled={pending} onClick={() => setItems(null)}>
          Zpět k textu
        </Button>
      </div>
    </div>
  );
}
