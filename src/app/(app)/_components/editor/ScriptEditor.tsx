'use client';

import { ArrowLeft, ListChecks, MessageSquare, Plus, Send, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useReducer, useRef, useState } from 'react';
import {
  closeCommentAction,
  decideSuggestionAction,
  markAddressedAction,
  reopenCommentAction,
  replyToCommentAction,
} from '@/app/(app)/kontrola/actions';
import { remapAnchor } from '@/domain/anchors/remap';
import { durationSec } from '@/domain/script/metrics';
import type { Cta } from '@/domain/script/types';
import type { ActionResult } from '@/server/actionResult';
import type { EditorOptions } from '@/server/editorOptions';
import type { ThreadVM } from '@/server/review';
import type { EditorValues, ScriptPageData } from '@/server/scripts';
import { BottomSheet } from '@/ui/BottomSheet';
import { Button } from '@/ui/Button';
import { cn, focusRing } from '@/ui/cn';
import { Field, Select, TextInput, Textarea } from '@/ui/Field';
import { useShell } from '@/ui/ShellContext';
import { StatusPill } from '@/ui/StatusPill';
import { Tabs } from '@/ui/Tabs';
import { saveDraftAction, submitForReviewAction, updateVideoMetaAction } from '@/app/(app)/scenare/actions';
import type { CommentActions } from '../review/CommentCard';
import { CommentsPanel } from '../review/CommentsPanel';
import { checkSummary } from '../review/model';
import { useReviewToast } from '../review/ReviewToast';
import { useIsDesktop } from '../review/useIsDesktop';
import { failingChecks } from '@/app/(app)/scenare/[code]/detailModel';
import { ChipInput } from './ChipInput';
import { FieldThreads } from './FieldThreads';
import { IconButton } from './IconButton';
import { LiveChecks, useLiveChecks } from './LiveChecks';
import { MetaForm } from './MetaForm';
import { SaveIndicator } from './SaveIndicator';
import { SceneRow } from './SceneRow';
import { SubmitDialog } from './SubmitDialog';
import { addHashtags, bodyReducer, metaPatch, speakerSuggestions } from './reducers';
import { RETRY_MESSAGE, useAutosave, type SaveOutcome } from './useAutosave';

const HOOK_IDS = ['A', 'B', 'C'] as const;
const FINAL_FAILURES = new Set(['FORBIDDEN', 'INVALID_TRANSITION', 'VALIDATION', 'NOT_FOUND']);

/** A failed save is retried unless the server refused it for a reason that will not go away. */
function toOutcome(result: ActionResult): SaveOutcome {
  if (result.ok) return { ok: true };
  const final = FINAL_FAILURES.has(result.code);
  return { ok: false, message: final ? result.message : RETRY_MESSAGE, retry: !final };
}

function SectionCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section aria-label={label} className="flex flex-col gap-4 rounded-card bg-card p-5 lg:p-6">
      <h2 className="text-h2">{label}</h2>
      {children}
    </section>
  );
}

export function ScriptEditor({ data, options }: { data: ScriptPageData; options: EditorOptions }) {
  const router = useRouter();
  const toast = useReviewToast();
  const desktop = useIsDesktop();
  const { currentMonth } = useShell();
  const speakerListId = useId();
  const videoId = data.video.id;

  // ---- state and autosave ----------------------------------------------------------------------
  const [body, dispatch] = useReducer(bodyReducer, data.draft);
  const [values, setValues] = useState<EditorValues>(data.values);
  const patchValues = useCallback((patch: Partial<EditorValues>) => setValues((v) => ({ ...v, ...patch })), []);

  const bodySave = useAutosave({
    value: body,
    initial: data.draft,
    save: async (next) => toOutcome(await saveDraftAction({ videoId, body: next })),
  });
  const metaSave = useAutosave({
    value: values,
    initial: data.values,
    save: async (next, saved) => {
      const patch = metaPatch(next, saved);
      return Object.keys(patch).length === 0 ? { ok: true } : toOutcome(await updateVideoMetaAction({ videoId, patch }));
    },
  });

  const saves = [bodySave, metaSave];
  const saveState = saves.some((s) => s.state === 'error') ? 'error' : saves.every((s) => s.state === 'saved') ? 'saved' : 'saving';
  const savedAt = saves.reduce<Date | null>((latest, s) => (s.savedAt && (!latest || s.savedAt > latest) ? s.savedAt : latest), null);
  const saveMessage = bodySave.error ?? metaSave.error;
  const retrySave = () => saves.forEach((s) => s.state === 'error' && s.retry());
  const flushAll = async () => (await Promise.all([bodySave.flush(), metaSave.flush()])).every(Boolean);

  useEffect(() => {
    if (saveState === 'saved') return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saveState]);

  // After accepting a suggestion the server's draft changes under us: take it over (nothing unsaved was left).
  const adoptNext = useRef(false);
  const bodyRef = useRef(body);
  useEffect(() => {
    bodyRef.current = body;
  });
  const serverDraft = JSON.stringify(data.draft);
  useEffect(() => {
    if (!adoptNext.current || serverDraft === JSON.stringify(bodyRef.current)) return;
    adoptNext.current = false;
    const next = JSON.parse(serverDraft) as typeof data.draft;
    bodySave.adopt(next);
    dispatch({ type: 'replace', body: next });
    // `bodySave.adopt` is stable; only a new server draft matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverDraft]);

  // ---- derived ---------------------------------------------------------------------------------
  const duration = durationSec(body);
  const checks = useLiveChecks(body, values, data);
  const { passed, total } = checkSummary(checks);
  const speakers = useMemo(
    () => speakerSuggestions(options.profiles.map((p) => p.speaker).filter((s): s is string => s !== null), body),
    [options.profiles, body],
  );
  const defaultCtaType: Cta['ctaType'] = (options.ctaTypes.find((c) => c.goalMetric === values.goalMetric)?.key as Cta['ctaType'] | undefined) ?? 'share';
  const cta = body.cta;

  // Comments that still sit on a field of the draft, grouped by that field.
  const threadsByField = useMemo(() => {
    const map = new Map<string, ThreadVM[]>();
    for (const thread of data.threads) {
      if (!thread.anchor || thread.isDetached || thread.status === 'closed') continue;
      const anchor = remapAnchor(thread.anchor, body);
      if (anchor.state === 'detached') continue;
      map.set(anchor.fieldId, [...(map.get(anchor.fieldId) ?? []), thread]);
    }
    return map;
  }, [data.threads, body]);

  // ---- side panel: checks and comments ---------------------------------------------------------
  const [tab, setTab] = useState<'checks' | 'comments'>('checks');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | undefined>();
  const [scrollTo, setScrollTo] = useState<{ id: string } | null>(null);
  const openThread = useCallback((id: string) => {
    setTab('comments');
    setActiveId(id);
    setSheetOpen(true);
    setScrollTo({ id });
  }, []);
  useEffect(() => {
    if (!scrollTo) return;
    const frame = requestAnimationFrame(() => document.getElementById(`comment-${scrollTo.id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    return () => cancelAnimationFrame(frame);
  }, [scrollTo, tab, sheetOpen, desktop]);

  const [busyCount, setBusyCount] = useState(0);
  async function perform<T extends object>(promise: Promise<ActionResult<T>>): Promise<ActionResult<T>> {
    setBusyCount((n) => n + 1);
    try {
      const result = await promise;
      if (!result.ok) toast(result.message, 'error');
      return result;
    } finally {
      setBusyCount((n) => n - 1);
    }
  }
  const now = useMemo(() => new Date(data.nowIso), [data.nowIso]);
  const commentActions: CommentActions = {
    reply: async (threadId, text, mentions) => (await perform(replyToCommentAction({ parentId: threadId, body: text, mentions }))).ok,
    close: async (commentId) => (await perform(closeCommentAction({ commentId }))).ok,
    reopen: async (commentId) => (await perform(reopenCommentAction({ commentId }))).ok,
    address: async (commentId) => (await perform(markAddressedAction({ commentId }))).ok,
    accept: async (commentId) => {
      // The suggestion is applied to the saved draft, so everything typed so far has to be on the server first.
      if (!(await flushAll())) {
        toast('Nejdřív se musí uložit tvoje změny.', 'error');
        return false;
      }
      adoptNext.current = true;
      const result = await perform(decideSuggestionAction({ commentId, accept: true }));
      if (!result.ok) {
        adoptNext.current = false;
        return false;
      }
      toast('Návrh přijat a zapracován');
      router.refresh();
      return true;
    },
    reject: async (commentId, reason) => (await perform(decideSuggestionAction({ commentId, accept: false, reason }))).ok,
  };

  const panel = (
    <div className="flex flex-col gap-4">
      <Tabs
        label="Kontrola a komentáře"
        variant="light"
        value={tab}
        onChange={(id) => setTab(id as 'checks' | 'comments')}
        items={[
          { id: 'checks', label: `Kontrola · ${passed}/${total}` },
          { id: 'comments', label: `Komentáře · ${data.threads.length}` },
        ]}
        className="w-full max-lg:bg-nest [&>button]:flex-1 [&>button]:px-2"
      />
      {tab === 'checks' ? (
        <LiveChecks checks={checks} numberChecks={data.numberChecks} />
      ) : (
        <CommentsPanel
          threads={data.threads}
          activeId={activeId}
          perms={data.perms}
          users={data.users}
          now={now}
          actions={commentActions}
          onActivate={setActiveId}
        />
      )}
    </div>
  );

  // ---- submit ----------------------------------------------------------------------------------
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function submit(changeSummary: string) {
    setSubmitBusy(true);
    setSubmitError(null);
    try {
      if (values.title.trim() === '') return setSubmitError('Zadej název scénáře.');
      if (!(await flushAll())) return setSubmitError('Změny se nepodařilo uložit. Zkus to za chvíli znovu.');
      const result = await submitForReviewAction({ videoId, changeSummary });
      if (!result.ok) return setSubmitError(result.message);
      toast(`Odesláno ke kontrole (v${result.versionNo})`);
      router.push(`/scenare/${data.video.code}`);
    } finally {
      setSubmitBusy(false);
    }
  }

  const submitButton = (className?: string) => (
    <Button variant="primary" className={className} onClick={() => setSubmitOpen(true)}>
      <Send aria-hidden className="size-4" />
      Odeslat ke kontrole
    </Button>
  );

  const spoken = (id: string) => threadsByField.get(id);
  const unusedHooks = HOOK_IDS.filter((id) => !body.hooks.some((h) => h.id === id));

  return (
    <div className="-mb-28 flex flex-col gap-4 pb-[calc(168px+env(safe-area-inset-bottom))] md:-mb-10 lg:mb-0 lg:pb-0">
      {/* On desktop the header sticks to the top; the lavender backdrop hides what scrolls beneath it. */}
      <div className="lg:sticky lg:top-0 lg:z-30 lg:-mt-8 lg:bg-lavender lg:pt-8">
        <header className="flex items-center gap-3 rounded-card bg-card p-4 lg:px-5">
          <Link href={`/scenare/${data.video.code}`} aria-label="Zpět na detail scénáře" className={cn('flex size-12 shrink-0 items-center justify-center rounded-full bg-nest', focusRing)}>
            <ArrowLeft aria-hidden className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold tracking-[0.08em] text-text2 uppercase">
              <span>
                {data.video.code} · {duration === null ? 'délka —' : `${duration} s`}
              </span>
              <StatusPill status={data.video.status} className="tracking-normal normal-case" />
            </p>
            <h1 className="truncate text-xl leading-tight font-semibold lg:text-h1">{values.title.trim() || 'Bez názvu'}</h1>
          </div>
          <SaveIndicator className="hidden lg:block" state={saveState} savedAt={savedAt} message={saveMessage} onRetry={retrySave} />
          <div className="hidden shrink-0 lg:block">{submitButton()}</div>
        </header>
      </div>

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <MetaForm values={values} onChange={patchValues} options={options} currentMonth={currentMonth} />

          <SectionCard label="Co divák získá">
            <Field label="Co se divák dozví">
              <Textarea value={body.viewerLearns} maxLength={1000} onChange={(event) => dispatch({ type: 'field', key: 'viewerLearns', value: event.target.value })} />
            </Field>
            <FieldThreads threads={spoken('viewerLearns')} onOpen={openThread} />
            <Field label="Zdroj">
              <TextInput value={body.source} maxLength={1000} onChange={(event) => dispatch({ type: 'field', key: 'source', value: event.target.value })} />
            </Field>
            <FieldThreads threads={spoken('source')} onOpen={openThread} />
          </SectionCard>

          <SectionCard label="Hook (0–2 s)">
            {body.hooks.map((hook) => (
              <div
                key={hook.id}
                role="group"
                aria-label={`Hook ${hook.id}`}
                className={cn('flex flex-col gap-3 rounded-inner p-4', hook.id === 'A' ? 'border-2 border-ink' : 'bg-nest')}
              >
                <div className="flex items-center gap-3">
                  <p className="text-h2 mr-auto">Hook {hook.id}</p>
                  {hook.id !== 'A' && (
                    <IconButton label={`Odebrat hook ${hook.id}`} onClick={() => dispatch({ type: 'removeHook', id: hook.id })}>
                      <Trash2 aria-hidden className="size-5" />
                    </IconButton>
                  )}
                </div>
                <Field label="Typ hooku">
                  <Select
                    value={hook.hookType ?? ''}
                    onChange={(event) => dispatch({ type: 'hook', id: hook.id, patch: { hookType: event.target.value || null } })}
                    className={hook.id === 'A' ? undefined : 'bg-card'}
                  >
                    <option value="">—</option>
                    {options.hookTypes.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Text hooku">
                  <Textarea
                    value={hook.text}
                    maxLength={1000}
                    onChange={(event) => dispatch({ type: 'hook', id: hook.id, patch: { text: event.target.value } })}
                    className={hook.id === 'A' ? undefined : 'bg-card'}
                  />
                </Field>
                <FieldThreads threads={spoken(`hook:${hook.id}:text`)} onOpen={openThread} />
                <Field label="Obraz hooku">
                  <Textarea
                    value={hook.visual}
                    maxLength={1000}
                    onChange={(event) => dispatch({ type: 'hook', id: hook.id, patch: { visual: event.target.value } })}
                    className={hook.id === 'A' ? undefined : 'bg-card'}
                  />
                </Field>
                <FieldThreads threads={spoken(`hook:${hook.id}:visual`)} onOpen={openThread} />
              </div>
            ))}
            {unusedHooks.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {unusedHooks.slice(0, 1).map((id) => (
                  <Button key={id} variant="outline" onClick={() => dispatch({ type: 'addHook' })}>
                    <Plus aria-hidden className="size-4" />
                    Hook {id}
                  </Button>
                ))}
              </div>
            )}
          </SectionCard>

          <datalist id={speakerListId}>
            {speakers.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          {body.scenes.map((scene, i) => (
            <SceneRow
              key={scene.id}
              scene={scene}
              index={i}
              count={body.scenes.length}
              cta={cta}
              ctaTypes={options.ctaTypes}
              defaultCtaType={defaultCtaType}
              speakerListId={speakerListId}
              threadsByField={threadsByField}
              dispatch={dispatch}
              onOpenThread={openThread}
            />
          ))}
          <div>
            <Button variant="outline" onClick={() => dispatch({ type: 'addScene' })}>
              <Plus aria-hidden className="size-4" />
              Scéna
            </Button>
          </div>

          <SectionCard label="Titulek a hashtagy">
            <Field label="Titulek">
              <Textarea value={body.caption} maxLength={2200} onChange={(event) => dispatch({ type: 'field', key: 'caption', value: event.target.value })} />
            </Field>
            <FieldThreads threads={spoken('caption')} onOpen={openThread} />
            <ChipInput
              label="Hashtagy"
              tags={body.hashtags}
              onChange={(value) => dispatch({ type: 'hashtags', value })}
              add={addHashtags}
              placeholder="Napiš hashtag a Enter"
              hint="Doporučeno 3–5, vždy #vaskonzultant a hashtag toho, kdo hraje."
            />
            <Field label="Čím se liší od posledních 3 videí">
              <Textarea
                value={body.differsFromLast3}
                maxLength={1000}
                onChange={(event) => dispatch({ type: 'field', key: 'differsFromLast3', value: event.target.value })}
              />
            </Field>
            <FieldThreads threads={spoken('differsFromLast3')} onOpen={openThread} />
          </SectionCard>
        </div>

        {desktop && (
          <aside aria-label="Kontrola a komentáře" className="sticky top-36 max-h-[calc(100dvh-10rem)] overflow-y-auto pr-1">
            {panel}
          </aside>
        )}
      </div>

      {/* Phone: save state and the main actions stay under the thumb. */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex flex-col gap-1 rounded-t-card bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_32px_rgba(23,21,31,0.14)] md:left-[100px] lg:hidden">
        <SaveIndicator state={saveState} savedAt={savedAt} message={saveMessage} onRetry={retrySave} />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setTab('checks');
              setSheetOpen(true);
            }}
            aria-label={`Kontrolní seznam, splněno ${passed} z ${total}`}
            className={cn('flex min-h-12 shrink-0 items-center gap-2 rounded-pill bg-nest px-4 font-semibold', focusRing)}
          >
            <ListChecks aria-hidden className="size-5" />
            {passed}/{total}
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('comments');
              setSheetOpen(true);
            }}
            aria-label={`Komentáře, ${data.threads.length}`}
            className={cn('flex min-h-12 shrink-0 items-center gap-2 rounded-pill bg-nest px-4 font-semibold', focusRing)}
          >
            <MessageSquare aria-hidden className="size-5" />
            {data.threads.length}
          </button>
          {submitButton('min-w-0 flex-1 px-3')}
        </div>
      </div>

      {!desktop && (
        <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Kontrola a komentáře">
          {panel}
        </BottomSheet>
      )}

      <SubmitDialog
        key={submitOpen ? 'open' : 'closed'}
        open={submitOpen}
        busy={submitBusy || busyCount > 0}
        error={submitError}
        warnings={failingChecks(checks)}
        hasPreviousVersion={data.latest !== null}
        onSubmit={(summary) => void submit(summary)}
        onCancel={() => {
          setSubmitOpen(false);
          setSubmitError(null);
        }}
      />
    </div>
  );
}
