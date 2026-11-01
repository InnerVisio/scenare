'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toPragueDateTimeInput } from '@/domain/format/pragueLocal';
import { formatDateTime } from '@/domain/format/date';
import { formatRate, METRIC_FIELDS, metricRates } from '@/domain/metrics/publication';
import type { Option, PublicationVM } from '@/server/publications';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field, Select, TextInput } from '@/ui/Field';
import { addPublicationAction, deletePublicationAction, updatePublicationAction } from '../../publikace/actions';

type MetricForm = Record<string, string>;
interface FormState {
  profileKey: string;
  publishedAt: string;
  variant: string;
  url: string;
  note: string;
  m24: MetricForm;
  m7: MetricForm;
}

const toForm = (m: Record<string, number> | null): MetricForm => Object.fromEntries(METRIC_FIELDS.map((f) => [f.key, m?.[f.key] !== undefined ? String(m[f.key]) : '']));

function MetricInputs({ title, value, onChange }: { title: string; value: MetricForm; onChange: (next: MetricForm) => void }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-semibold text-text2">{title}</legend>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {METRIC_FIELDS.map((f) => (
          <Field key={f.key} label={f.label}>
            <TextInput inputMode="decimal" value={value[f.key]} onChange={(event) => onChange({ ...value, [f.key]: event.target.value })} />
          </Field>
        ))}
      </div>
    </fieldset>
  );
}

function PublicationForm({
  initial,
  profiles,
  variants,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: FormState;
  profiles: Option[];
  variants: Option[];
  submitLabel: string;
  onSubmit: (state: FormState) => Promise<{ ok: true } | { ok: false; message: string }>;
  onCancel: () => void;
}) {
  const [state, setState] = useState(initial);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setState((prev) => ({ ...prev, [key]: value }));
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          setError('');
          const result = await onSubmit(state);
          if (!result.ok) setError(result.message);
        });
      }}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Profil">
          <Select value={state.profileKey} onChange={(event) => set('profileKey', event.target.value)}>
            {profiles.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Datum a čas publikace">
          <TextInput type="datetime-local" required value={state.publishedAt} onChange={(event) => set('publishedAt', event.target.value)} />
        </Field>
        <Field label="Varianta">
          <Select value={state.variant} onChange={(event) => set('variant', event.target.value)}>
            {variants.map((v) => (
              <option key={v.key} value={v.key}>
                {v.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Odkaz na publikaci">
          <TextInput type="url" inputMode="url" placeholder="https://" value={state.url} onChange={(event) => set('url', event.target.value)} />
        </Field>
      </div>
      <Field label="Poznámka">
        <TextInput value={state.note} onChange={(event) => set('note', event.target.value)} />
      </Field>
      <MetricInputs title="Metriky po 24 h" value={state.m24} onChange={(m) => set('m24', m)} />
      <MetricInputs title="Metriky po 7 dnech" value={state.m7} onChange={(m) => set('m7', m)} />
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger-text">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" pending={pending}>
          {submitLabel}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Zrušit
        </Button>
      </div>
    </form>
  );
}

const num = new Intl.NumberFormat('cs-CZ');

function MetricSummary({ title, metrics }: { title: string; metrics: Record<string, number> | null }) {
  if (!metrics) return <p className="text-sm text-text2">{title}: zatím nevyplněno</p>;
  const rates = metricRates(metrics);
  const shown = METRIC_FIELDS.filter((f) => metrics[f.key] !== undefined);
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-semibold text-text2">{title}</p>
      <p className="text-sm">
        {shown.map((f) => `${f.label.replace(/ \(.*\)$/, '')} ${num.format(metrics[f.key])}`).join(' · ')}
      </p>
      {(rates.shareRate !== null || rates.saveRate !== null || rates.commentRate !== null) && (
        <p className="text-sm text-text2">
          Sdílení/dosah {formatRate(rates.shareRate)} · uložení/dosah {formatRate(rates.saveRate)} · komentáře/dosah {formatRate(rates.commentRate)}
        </p>
      )}
    </div>
  );
}

/** „Publikace“ of one script: the list for everybody, add / edit / delete and the metrics forms for admin. */
export function PublicationsBlock({
  videoId,
  publications,
  profiles,
  variants,
  defaultProfile,
  canManage,
}: {
  videoId: string;
  publications: PublicationVM[];
  profiles: Option[];
  variants: Option[];
  defaultProfile: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'none' | 'add' | string>('none');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [deleting, startDelete] = useTransition();
  const done = () => {
    setMode('none');
    router.refresh();
  };
  const blank: FormState = {
    profileKey: profiles.some((p) => p.key === defaultProfile) ? defaultProfile : (profiles[0]?.key ?? ''),
    publishedAt: toPragueDateTimeInput(new Date()),
    variant: variants[0]?.key ?? 'hlavni-verze',
    url: '',
    note: '',
    m24: toForm(null),
    m7: toForm(null),
  };
  const payload = (st: FormState) => ({ profileKey: st.profileKey, publishedAt: st.publishedAt, variant: st.variant, url: st.url, note: st.note, metrics24h: st.m24, metrics7d: st.m7 });

  return (
    <section aria-label="Publikace" className="flex flex-col gap-3">
      <h2 className="text-h2 px-1">Publikace</h2>
      {publications.length === 0 && mode !== 'add' && <p className="rounded-card bg-card p-5 text-text2">Zatím nic nebylo publikováno.</p>}
      {publications.map((p) =>
        mode === p.id ? (
          <Card key={p.id}>
            <PublicationForm
              initial={{ profileKey: p.profileKey, publishedAt: toPragueDateTimeInput(new Date(p.publishedAt)), variant: p.variant, url: p.url, note: p.note, m24: toForm(p.metrics24h), m7: toForm(p.metrics7d) }}
              profiles={profiles}
              variants={variants}
              submitLabel="Uložit publikaci"
              onCancel={() => setMode('none')}
              onSubmit={async (st) => {
                const result = await updatePublicationAction({ publicationId: p.id, ...payload(st) });
                if (result.ok) done();
                return result;
              }}
            />
          </Card>
        ) : (
          <Card key={p.id} className="flex flex-col gap-3" data-testid="publication">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="font-semibold">{p.variantLabel}</p>
              <p className="text-text2">
                {p.profileLabel} · {formatDateTime(new Date(p.publishedAt))}
              </p>
            </div>
            {p.url ? (
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="min-h-6 break-all text-violet underline">
                {p.url}
              </a>
            ) : (
              <p className="text-sm font-semibold text-apricot-ink">Bez odkazu</p>
            )}
            {p.note && <p className="text-text2">{p.note}</p>}
            <MetricSummary title="Po 24 h" metrics={p.metrics24h} />
            <MetricSummary title="Po 7 dnech" metrics={p.metrics7d} />
            {canManage && (
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => setMode(p.id)}>
                  Upravit
                </Button>
                {confirmDelete === p.id ? (
                  <>
                    <Button
                      variant="danger"
                      pending={deleting}
                      onClick={() =>
                        startDelete(async () => {
                          const result = await deletePublicationAction({ publicationId: p.id });
                          setConfirmDelete(null);
                          if (result.ok) done();
                          else setError(result.message);
                        })
                      }
                    >
                      Opravdu smazat
                    </Button>
                    <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
                      Ponechat
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" onClick={() => setConfirmDelete(p.id)}>
                    Smazat
                  </Button>
                )}
              </div>
            )}
          </Card>
        ),
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger-text">
          {error}
        </p>
      )}
      {canManage &&
        (mode === 'add' ? (
          <Card>
            <PublicationForm
              initial={blank}
              profiles={profiles}
              variants={variants}
              submitLabel="Přidat publikaci"
              onCancel={() => setMode('none')}
              onSubmit={async (st) => {
                const result = await addPublicationAction({ videoId, ...payload(st) });
                if (result.ok) done();
                return result;
              }}
            />
          </Card>
        ) : (
          <div>
            <Button variant="outline" onClick={() => setMode('add')}>
              Přidat publikaci
            </Button>
          </div>
        ))}
    </section>
  );
}
