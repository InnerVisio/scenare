'use client';

import { useRouter } from 'next/navigation';
import { weekdayShortDate, weekdayShortDateYear } from '@/domain/format/date';
import { whatsappHref } from '../_components/ShareReview';
import { Plus } from 'lucide-react';
import { useState, useTransition, type ReactNode } from 'react';
import { ROLE_LABELS } from '@/ui/roles';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field, Select, TextInput, Textarea } from '@/ui/Field';
import { Tabs } from '@/ui/Tabs';
import { ReviewDialog } from '../_components/review/ReviewDialog';
import { cn } from '@/ui/cn';
import type { Role } from '@/domain/policy/can';
import { addShootingDayAction, createLoginLink, deleteShootingDayAction, updateShootingDayAction, saveLookups, saveSettings, saveUser } from './actions';
import { LOOKUP_KINDS, type DataField } from './lookupKinds';

interface Result {
  ok: boolean;
  message?: string;
}

/** Runs a save action, keeps a Czech status line for the section. */
function useSave() {
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (action: () => Promise<Result>) =>
    start(async () => {
      const result = await action();
      setStatus(result.ok ? { ok: true, text: 'Uloženo.' } : { ok: false, text: result.message ?? 'Uložení se nepovedlo.' });
    });
  return { pending, status, run };
}

function Status({ status }: { status: { ok: boolean; text: string } | null }) {
  return (
    <p role="status" className={cn('min-h-6 text-sm font-semibold', status && !status.ok ? 'text-danger-text' : 'text-text2')}>
      {status?.text}
    </p>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="text-h2">{title}</h2>
        {hint && <p className="mt-1 text-text2">{hint}</p>}
      </div>
      {children}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------

const POLICY_LABELS = [
  { value: 'all_leadership', label: 'Oba z vedení' },
  { value: 'any_leadership', label: 'Kdokoli z vedení' },
  { value: 'series_guarantor', label: 'Garant série' },
];

interface SettingsValue {
  monthlyTarget: number;
  approvalDaysBefore: number;
  tolerancePp: number;
  approvalPolicy: string;
}

function ParamsSection({ settings }: { settings: SettingsValue }) {
  const [v, setV] = useState(settings);
  const save = useSave();
  const num = (key: 'monthlyTarget' | 'approvalDaysBefore' | 'tolerancePp') => ({
    type: 'number' as const,
    inputMode: 'numeric' as const,
    value: v[key],
    onChange: (e: { target: { value: string } }) => setV({ ...v, [key]: Number(e.target.value) }),
  });
  return (
    <Section title="Parametry">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.run(() => saveSettings(v));
        }}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Měsíční cíl videí">
            <TextInput {...num('monthlyTarget')} />
          </Field>
          <Field label="Termín schválení (dní před natáčením)">
            <TextInput {...num('approvalDaysBefore')} />
          </Field>
          <Field label="Tolerance mixu (±)" hint="V počtu videí.">
            <TextInput {...num('tolerancePp')} />
          </Field>
          <Field label="Kdo schvaluje">
            <Select value={v.approvalPolicy} onChange={(e) => setV({ ...v, approvalPolicy: e.target.value })}>
              {POLICY_LABELS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" pending={save.pending}>
            Uložit parametry
          </Button>
          <Status status={save.status} />
        </div>
      </form>
    </Section>
  );
}

// ---------------------------------------------------------------------------------------------

interface CycleRow {
  id: string;
  shootDate: string | null;
  plannedVideos: number;
  note: string;
  scripts: number;
}

const MONTHS_IN = ['lednu', 'únoru', 'březnu', 'dubnu', 'květnu', 'červnu', 'červenci', 'srpnu', 'září', 'říjnu', 'listopadu', 'prosinci'];
const scriptsWord = (n: number) => (n === 1 ? 'scénář' : n >= 2 && n <= 4 ? 'scénáře' : 'scénářů');

function DayRow({ day, others }: { day: CycleRow; others: CycleRow[] }) {
  const save = useSave();
  const [confirming, setConfirming] = useState(false);
  const [moveTo, setMoveTo] = useState('');
  const monthIn = MONTHS_IN[Number((day.shootDate ?? `${day.id}-01`).slice(5, 7)) - 1];
  const dayLabel = day.shootDate ? weekdayShortDate(day.shootDate) : day.id;
  const runDelete = (target: string | null) => save.run(async () => {
    const r = await deleteShootingDayAction({ id: day.id, moveTo: target });
    if (r.ok) setConfirming(false);
    return done(r);
  });
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(day.shootDate ?? '');
  const [planned, setPlanned] = useState(String(day.plannedVideos));
  const [note, setNote] = useState(day.note);
  const title = day.shootDate ? weekdayShortDateYear(day.shootDate) : `${day.id} · bez data`;
  const router = useRouter();
  const done = (r: Result) => {
    if (r.ok) {
      setEditing(false);
      router.refresh();
    }
    return r;
  };

  if (!editing) {
    return (
      <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink/10 py-3">
        <span className="min-w-36 font-semibold">{title}</span>
        <span>{day.plannedVideos} videí</span>
        <span className="text-text2">{day.scripts} scénářů</span>
        <span className="min-w-0 flex-1 text-text2">{day.note}</span>
        <Button variant="outline" onClick={() => setEditing(true)}>
          Upravit
        </Button>
        <Button variant="outline" pending={save.pending} onClick={() => (day.scripts > 0 ? setConfirming(true) : window.confirm(`Smazat natáčecí den ${dayLabel}?`) && runDelete(null))}>
          Smazat
        </Button>
        <ReviewDialog open={confirming} onClose={() => setConfirming(false)} title={`Smazat natáčecí den ${dayLabel}?`}>
          <p className="text-text2">Je na něm {day.scripts} {scriptsWord(day.scripts)}. Co s nimi?</p>
          <Field label="Scénáře">
            <Select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              <option value="">Nechat bez natáčecího dne (zůstanou v {monthIn})</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.shootDate ? weekdayShortDateYear(o.shootDate) : `${o.id} · bez data`}
                </option>
              ))}
            </Select>
          </Field>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Zpět
            </Button>
            <Button variant="danger" pending={save.pending} onClick={() => runDelete(moveTo || null)}>
              Smazat
            </Button>
          </div>
        </ReviewDialog>
        <Status status={save.status} />
      </li>
    );
  }
  return (
    <li className="border-t border-ink/10 py-3">
      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(event) => {
          event.preventDefault();
          save.run(async () =>
            done(await updateShootingDayAction({ id: day.id, shootDate: date, plannedVideos: Number(planned), note })),
          );
        }}
      >
        <Field label="Datum">
          <TextInput type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Plán videí">
          <TextInput type="number" min={0} max={200} required value={planned} onChange={(e) => setPlanned(e.target.value)} />
        </Field>
        <Field label="Poznámka (kde se točí)">
          <TextInput value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <div className="flex items-end gap-3">
          <Button type="submit" pending={save.pending}>
            Uložit den
          </Button>
          <Button type="button" variant="outline" onClick={() => setEditing(false)}>
            Zrušit
          </Button>
        </div>
        <Status status={save.status} />
      </form>
    </li>
  );
}

function CyclesSection({ cycles, today }: { cycles: CycleRow[]; today: string }) {
  const save = useSave();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState('');
  const [planned, setPlanned] = useState('');
  const [note, setNote] = useState('');
  const sorted = [...cycles].sort((a, b) => (a.shootDate ?? a.id).localeCompare(b.shootDate ?? b.id));
  const isPast = (c: CycleRow) => (c.shootDate ?? `${c.id}-01`) < today;
  const upcoming = sorted.filter((c) => !isPast(c));
  const past = sorted.filter(isPast).reverse();
  return (
    <Section title="Natáčecí dny">
      <ul>
        {upcoming.map((c) => (
          <DayRow key={c.id} day={c} others={sorted.filter((o) => o.id !== c.id)} />
        ))}
      </ul>
      {adding ? (
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.run(async () => {
              const r = await addShootingDayAction({ shootDate: date, ...(planned ? { plannedVideos: Number(planned) } : {}), note });
              if (r.ok) {
                setAdding(false);
                setDate('');
                setPlanned('');
                setNote('');
                router.refresh();
              }
              return r;
            });
          }}
        >
          <Field label="Datum natáčení">
            <TextInput type="date" required min={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Plán videí">
            <TextInput type="number" min={0} max={200} placeholder="podle měsíčního cíle" value={planned} onChange={(e) => setPlanned(e.target.value)} />
          </Field>
          <Field label="Poznámka (kde se točí)">
            <TextInput value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="flex items-end gap-3">
            <Button type="submit" pending={save.pending}>
              Přidat den
            </Button>
            <Button type="button" variant="outline" onClick={() => setAdding(false)}>
              Zrušit
            </Button>
          </div>
        </form>
      ) : (
        <div>
          <Button variant="outline" onClick={() => setAdding(true)}>
            <Plus aria-hidden className="size-5" />
            Přidat natáčecí den
          </Button>
        </div>
      )}
      <Status status={save.status} />
      {past.length > 0 && (
        <details>
          <summary className="cursor-pointer font-semibold">Starší ({past.length})</summary>
          <ul>
            {past.map((c) => (
              <DayRow key={c.id} day={c} others={sorted.filter((o) => o.id !== c.id)} />
            ))}
          </ul>
        </details>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------------------------------------

export interface LookupRowValue {
  id?: string;
  kind: string;
  key: string;
  label: string;
  sortOrder: number;
  archived: boolean;
  data: Record<string, unknown>;
}

const slug = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'polozka';

const RULE_SEVERITIES = [
  { value: 'reject', label: 'Vrátit' },
  { value: 'warn', label: 'Varování' },
  { value: 'tip', label: 'Tip' },
];
const RULE_MODES = [
  { value: 'auto', label: 'Automaticky' },
  { value: 'manual', label: 'Ručně' },
];

function FieldInput({ field, row, onData }: { field: DataField; row: LookupRowValue; onData: (name: string, value: unknown) => void }) {
  const raw = row.data[field.name];
  if (field.type === 'percent') {
    const pct = typeof raw === 'number' ? Math.round(raw * 10000) / 100 : '';
    return (
      <TextInput
        type="number"
        inputMode="decimal"
        step="any"
        value={pct}
        onChange={(e) => onData(field.name, e.target.value === '' ? null : Number((Number(e.target.value) / 100).toFixed(4)))}
      />
    );
  }
  if (field.type === 'select') {
    return (
      <Select value={typeof raw === 'string' ? raw : ''} onChange={(e) => onData(field.name, e.target.value || null)}>
        <option value="">–</option>
        {field.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    );
  }
  if (field.type === 'textarea') return <Textarea value={typeof raw === 'string' ? raw : ''} onChange={(e) => onData(field.name, e.target.value)} />;
  return <TextInput value={typeof raw === 'string' ? raw : ''} onChange={(e) => onData(field.name, e.target.value)} />;
}

function LookupEditor({ kind, initial, fields }: { kind: string; initial: LookupRowValue[]; fields: DataField[] }) {
  const [rows, setRows] = useState(initial);
  const save = useSave();
  const patch = (i: number, change: Partial<LookupRowValue>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...change } : r)));
  const patchData = (i: number, name: string, value: unknown) => patch(i, { data: { ...rows[i].data, [name]: value } });

  function submit() {
    const taken = new Set(rows.filter((r) => r.key).map((r) => r.key));
    const items = rows
      .filter((r) => r.label.trim() !== '')
      .map((r) => {
        let key = r.key;
        if (!key) {
          const base = slug(r.label);
          key = base;
          for (let n = 2; taken.has(key); n += 1) key = `${base}-${n}`;
          taken.add(key);
        }
        return { kind, key, label: r.label, sortOrder: r.sortOrder, archived: r.archived, data: r.data };
      });
    save.run(() => saveLookups({ items }));
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, i) => (
        <div key={row.key || `new-${i}`} className="grid gap-3 rounded-inner bg-nest p-4 md:grid-cols-2">
          <Field label="Název">
            <TextInput className="bg-card" value={row.label} onChange={(e) => patch(i, { label: e.target.value })} />
          </Field>
          <Field label="Pořadí">
            <TextInput className="bg-card" type="number" inputMode="numeric" value={row.sortOrder} onChange={(e) => patch(i, { sortOrder: Number(e.target.value) })} />
          </Field>
          {fields.map((f) => (
            <Field key={f.name} label={f.label} className={f.type === 'textarea' ? 'md:col-span-2' : undefined}>
              <FieldInput field={f} row={row} onData={(name, value) => patchData(i, name, value)} />
            </Field>
          ))}
          <label className="flex min-h-12 items-center gap-3 font-semibold">
            <input type="checkbox" className="size-6 accent-violet" checked={row.archived} onChange={(e) => patch(i, { archived: e.target.checked })} />
            Archivováno
          </label>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          onClick={() => setRows([...rows, { kind, key: '', label: '', sortOrder: (rows.at(-1)?.sortOrder ?? 0) + 10, archived: false, data: {} }])}
        >
          <Plus aria-hidden className="size-5" />
          Přidat položku
        </Button>
        <Button pending={save.pending} onClick={submit}>
          Uložit
        </Button>
        <Status status={save.status} />
      </div>
    </div>
  );
}

function LookupsSection({ lookups }: { lookups: Record<string, LookupRowValue[]> }) {
  const [kind, setKind] = useState(LOOKUP_KINDS[0].kind);
  const current = LOOKUP_KINDS.find((k) => k.kind === kind)!;
  return (
    <Section title="Číselníky" hint="Podíly kategorií musí dávat dohromady 100 %.">
      <Tabs label="Druh číselníku" items={LOOKUP_KINDS.map((k) => ({ id: k.kind, label: k.label }))} value={kind} onChange={setKind} />
      <LookupEditor key={kind} kind={kind} initial={lookups[kind] ?? []} fields={current.fields} />
    </Section>
  );
}

// ---------------------------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function RulesSection({ rules }: { rules: LookupRowValue[] }) {
  const [rows, setRows] = useState(rules);
  const save = useSave();
  const patchData = (i: number, name: string, value: unknown) =>
    setRows(rows.map((r, j) => (j === i ? { ...r, data: { ...r.data, [name]: value } } : r)));
  return (
    <Section title="Pravidla kontroly">
      <ul className="flex flex-col gap-3">
        {rows.map((row, i) => (
          <li key={row.key} className="grid gap-3 rounded-inner bg-nest p-4 md:grid-cols-[1fr_12rem_12rem] md:items-end">
            <label className="flex min-h-12 items-center gap-3 font-semibold">
              <input
                type="checkbox"
                className="size-6 shrink-0 accent-violet"
                checked={row.data.enabled !== false}
                onChange={(e) => patchData(i, 'enabled', e.target.checked)}
              />
              <span>
                {row.label} <span className="text-sm font-normal text-text2">({row.key})</span>
              </span>
            </label>
            <Field label="Závažnost">
              <Select className="bg-card" value={String(row.data.severity ?? 'warn')} onChange={(e) => patchData(i, 'severity', e.target.value)}>
                {RULE_SEVERITIES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Režim">
              <Select className="bg-card" value={row.data.mode === 'manual' ? 'manual' : 'auto'} onChange={(e) => patchData(i, 'mode', e.target.value)}>
                {RULE_MODES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          pending={save.pending}
          onClick={() =>
            save.run(() =>
              saveLookups({ items: rows.map((r) => ({ kind: 'check_rule', key: r.key, label: r.label, sortOrder: r.sortOrder, archived: r.archived, data: r.data })) }),
            )
          }
        >
          Uložit pravidla
        </Button>
        <Status status={save.status} />
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------------------------

interface UserValue {
  id?: string;
  name: string;
  email: string;
  role: Role;
  initials: string;
  notifyEmail?: boolean;
}

function LoginLink({ userId }: { userId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  return (
    <div className="flex flex-col gap-3 md:col-span-4">
      <div>
        <Button
          type="button"
          variant="outline"
          pending={pending}
          onClick={() =>
            start(async () => {
              setNote(null);
              const result = await createLoginLink({ userId });
              if (result.ok) {
                setUrl(result.url);
                setError(null);
              } else setError(result.message);
            })
          }
        >
          Přihlašovací odkaz
        </Button>
      </div>
      {error ? <p className="text-coral">{error}</p> : null}
      {url ? (
        <div className="flex flex-col gap-2 rounded-inner bg-card p-3">
          <input readOnly aria-label="Přihlašovací odkaz" value={url} onFocus={(e) => e.currentTarget.select()} className="min-h-12 w-full rounded-inner bg-nest px-3 text-sm" />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                void navigator.clipboard
                  .writeText(url)
                  .then(() => setNote('Zkopírováno.'))
                  .catch(() => setNote('Kopírování se nepovedlo, označ odkaz a zkopíruj ho ručně.'))
              }
            >
              Kopírovat
            </Button>
            {canShare ? (
              <Button type="button" variant="outline" onClick={() => void navigator.share({ url }).catch(() => undefined)}>
                Sdílet
              </Button>
            ) : null}
            <a href={whatsappHref(url)} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center rounded-full border border-ink/20 px-5 font-semibold">
              WhatsApp
            </a>
            {note ? <span role="status" className="text-sm text-text2">{note}</span> : null}
          </div>
          <p className="text-sm text-text2">Odkaz platí 7 dní a jde použít jednou. Po otevření zůstaneš přihlášený 90 dní.</p>
        </div>
      ) : null}
    </div>
  );
}

function UserRow({ initial }: { initial: UserValue }) {
  const [u, setU] = useState(initial);
  const save = useSave();
  return (
    <form
      className="grid gap-3 rounded-inner bg-nest p-4 md:grid-cols-[1fr_1.4fr_10rem_6rem]"
      onSubmit={(e) => {
        e.preventDefault();
        save.run(() => saveUser(u));
      }}
    >
      <Field label="Jméno">
        <TextInput className="bg-card" value={u.name} onChange={(e) => setU({ ...u, name: e.target.value })} />
      </Field>
      <Field label="E-mail">
        <TextInput className="bg-card" type="email" value={u.email} onChange={(e) => setU({ ...u, email: e.target.value })} />
      </Field>
      <Field label="Role">
        <Select className="bg-card" value={u.role} onChange={(e) => setU({ ...u, role: e.target.value as Role })}>
          {(Object.keys(ROLE_LABELS) as Role[]).map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Iniciály">
        <TextInput className="bg-card" value={u.initials} maxLength={3} onChange={(e) => setU({ ...u, initials: e.target.value })} />
      </Field>
      <label className="flex min-h-12 items-center gap-3 font-semibold md:col-span-4">
        <input
          type="checkbox"
          className="size-6 accent-violet"
          checked={u.notifyEmail !== false}
          onChange={(e) => setU({ ...u, notifyEmail: e.target.checked })}
        />
        Posílat e-maily
      </label>
      <div className="flex flex-wrap items-center gap-3 md:col-span-4">
        <Button type="submit" variant="outline" pending={save.pending}>
          Uložit uživatele
        </Button>
        <Status status={save.status} />
      </div>
      {initial.id ? <LoginLink userId={initial.id} /> : null}
    </form>
  );
}

function UsersSection({ users }: { users: UserValue[] }) {
  const [extra, setExtra] = useState(0);
  return (
    <Section title="Uživatelé">
      <div className="flex flex-col gap-3">
        {users.map((u) => (
          <UserRow key={u.id} initial={u} />
        ))}
        {Array.from({ length: extra }, (_, i) => (
          <UserRow key={`new-${i}`} initial={{ name: '', email: '', role: 'marketer', initials: '' }} />
        ))}
      </div>
      <div>
        <Button variant="outline" onClick={() => setExtra(extra + 1)}>
          <Plus aria-hidden className="size-5" />
          Přidat uživatele
        </Button>
      </div>
    </Section>
  );
}

// ---------------------------------------------------------------------------------------------

export function SettingsForms({
  settings,
  cycles,
  today,
  users,
  rules,
  lookups,
}: {
  settings: SettingsValue;
  cycles: CycleRow[];
  today: string;
  users: UserValue[];
  rules: LookupRowValue[];
  lookups: Record<string, LookupRowValue[]>;
}) {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <ParamsSection settings={settings} />
      <CyclesSection cycles={cycles} today={today} />
      <LookupsSection lookups={lookups} />
      {/* Pravidla kontroly are hidden for now; RulesSection and the data stay. */}
      <UsersSection users={users} />
    </div>
  );
}
