'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { formatDateTime } from '@/domain/format/date';
import type { ScriptPageData } from '@/server/scripts';
import { cn, focusRing } from '@/ui/cn';
import { Field, Select } from '@/ui/Field';
import { StatusPill } from '@/ui/StatusPill';
import { Tabs } from '@/ui/Tabs';
import { VersionsPanel } from '../../_components/review/VersionsPanel';
import { ScriptView } from '../../_components/script-view/ScriptView';
import { DetailActions } from './DetailActions';
import { failingChecks, progressLine } from './detailModel';

export function ScriptDetail({ data }: { data: ScriptPageData }) {
  const { video, latest, versions, actions } = data;
  const latestNo = latest?.no ?? null;
  const [view, setView] = useState<'read' | 'compare'>('read');
  const [from, setFrom] = useState<number | null>(latestNo !== null && latestNo > 1 ? latestNo - 1 : null);
  const [to, setTo] = useState<number | null>(latestNo);

  const canCompare = versions.length >= 2;
  const comparing = view === 'compare' && canCompare && from !== null && to !== null;
  const progress = progressLine(video.status, data.approval, data.actor.name);
  const openComments = data.threads.filter((t) => t.status === 'open').length;

  const versionOptions = versions.map((v) => (
    <option key={v.id} value={v.no}>
      v{v.no}
    </option>
  ));

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-4 rounded-card bg-card p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Link href="/scenare" aria-label="Zpět na scénáře" className={cn('flex size-12 shrink-0 items-center justify-center rounded-full bg-nest', focusRing)}>
            <ArrowLeft aria-hidden className="size-5" />
          </Link>
          <p className="text-sm font-semibold tracking-[0.08em] text-text2 uppercase">
            {video.code}
            {latestNo !== null ? ` · v${latestNo}` : ' · návrh'}
          </p>
          <StatusPill status={video.status} />
          {progress && (
            <p className="flex items-center gap-2 text-sm font-semibold text-text2">
              <span aria-hidden className="flex gap-1">
                {Array.from({ length: progress.total }, (_, i) => (
                  <span key={i} className={cn('h-2 w-6 rounded-full', i < progress.done ? 'bg-lime-dot' : 'bg-ink/10')} />
                ))}
              </span>
              {progress.text}
            </p>
          )}
          {openComments > 0 && (
            <p className="text-sm font-semibold text-apricot-ink">
              {openComments} {openComments === 1 ? 'otevřený komentář' : openComments < 5 ? 'otevřené komentáře' : 'otevřených komentářů'}
            </p>
          )}
        </div>
        {(video.status === 'postponed' || video.status === 'cancelled') && video.lifecycleReason && (
          <p className="rounded-inner bg-nest px-4 py-3 text-text2">
            <b className="text-ink">{video.status === 'cancelled' ? 'Zrušeno' : 'Odloženo'}:</b> {video.lifecycleReason}
          </p>
        )}
        {actions.edit && data.draftAhead && (
          <p role="status" className="rounded-inner bg-apricot-soft px-4 py-3 text-apricot-ink">
            Máš rozpracované změny oproti v{latestNo}. Pokračuj v úpravách a pošli je jako další verzi.
          </p>
        )}
        <DetailActions
          videoId={video.id}
          code={video.code}
          actions={actions}
          hasPreviousVersion={latestNo !== null}
          warnings={failingChecks(data.checks)}
        />
      </header>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <section aria-label="Scénář" className="flex min-w-0 flex-col gap-5 rounded-card bg-card p-5 lg:p-6">
          {canCompare && (
            <div className="flex flex-col gap-3">
              <Tabs
                label="Zobrazení scénáře"
                items={[
                  { id: 'read', label: `v${latestNo} · aktuální` },
                  { id: 'compare', label: 'Porovnat verze' },
                ]}
                value={view}
                onChange={(id) => setView(id as 'read' | 'compare')}
                className="w-fit"
              />
              {view === 'compare' && (
                <div className="grid grid-cols-2 gap-3 sm:max-w-md">
                  <Field label="Porovnat verzi">
                    <Select value={from ?? ''} onChange={(event) => setFrom(Number(event.target.value))}>
                      {versionOptions}
                    </Select>
                  </Field>
                  <Field label="s verzí">
                    <Select value={to ?? ''} onChange={(event) => setTo(Number(event.target.value))}>
                      {versionOptions}
                    </Select>
                  </Field>
                </div>
              )}
            </div>
          )}
          {comparing && from === to && <p className="rounded-inner bg-nest p-4 text-text2">Vybraná je stejná verze, není co porovnávat.</p>}
          <ScriptView
            body={comparing ? data.bodies[to] : data.body}
            meta={comparing ? { ...data.meta, versionNo: to } : data.meta}
            mode={comparing ? 'diff' : 'read'}
            diffAgainst={comparing ? data.bodies[from] : undefined}
            threads={[]}
            hookTypeLabels={data.hookTypeLabels}
          />
        </section>

        <aside aria-label="Verze a historie" className="flex flex-col gap-4">
          <section aria-label="Verze" className="flex flex-col gap-3">
            <h2 className="text-h2 px-1">Verze</h2>
            <VersionsPanel
              versions={versions}
              latestNo={latestNo}
              onCompare={(no) => {
                setFrom(no);
                setTo(latestNo);
                setView('compare');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </section>
          <section aria-label="Historie" className="flex flex-col gap-3">
            <h2 className="text-h2 px-1">Historie</h2>
            {data.activity.length === 0 ? (
              <p className="rounded-card bg-card p-5 text-text2">Zatím se nic nestalo.</p>
            ) : (
              <ol className="flex flex-col rounded-card bg-card px-5 py-2">
                {data.activity.map((entry, i) => (
                  <li key={i} className="border-t border-ink/10 py-3 first:border-t-0">
                    <p>{entry.text}</p>
                    <p className="text-sm text-text2">{formatDateTime(new Date(entry.createdAt))}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
