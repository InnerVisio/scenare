'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  closeCommentAction,
  confirmNumberAction,
  createCommentAction,
  decideAction,
  decideSuggestionAction,
  flagNumberAction,
  markAddressedAction,
  markSeenAction,
  reopenCommentAction,
  replyToCommentAction,
  setManualCheckAction,
} from '@/app/(app)/kontrola/actions';
import { formatDayMonth } from '@/domain/format/date';
import type { ActionResult } from '@/server/actionResult';
import type { ReviewData } from '@/server/review';
import { Button } from '@/ui/Button';
import { Tabs } from '@/ui/Tabs';
import { cn, focusRing } from '@/ui/cn';
import { ScriptView } from '../script-view/ScriptView';
import { SelectionToolbar } from '../script-view/SelectionToolbar';
import type { AnchoredThread, NewAnchor, ScriptViewMode } from '../script-view/types';
import { ActionBar } from './ActionBar';
import { ChecksPanel } from './ChecksPanel';
import { CommentPreview, type CommentActions } from './CommentCard';
import { CommentsPanel } from './CommentsPanel';
import { Composer, type ComposerSubmit, type ComposerTarget } from './Composer';
import { ConfirmDialog } from './ConfirmDialog';
import { QueueList } from './QueueList';
import { ReturnDialog } from './ReturnDialog';
import { ReviewSidebar, type SidebarTab } from './ReviewSidebar';
import { useReviewToast } from './ReviewToast';
import { VersionsPanel } from './VersionsPanel';
import {
  approvalLine,
  checkSummary,
  decisionToast,
  defaultCenterView,
  newVersionNotice,
  nextUndecidedCode,
  unresolvedCount,
} from './model';
import { useIsDesktop } from './useIsDesktop';

const REFRESH_MS = 10_000;

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

export function ReviewScreen({ data, query }: { data: ReviewData; query: string }) {
  const router = useRouter();
  const toast = useReviewToast();
  const desktop = useIsDesktop();

  const { video, perms } = data;
  // The version on screen. A newer one that shows up later does not replace it until the reviewer
  // chooses to look (see the banner); approve / return / comments always refer to this one.
  const [pinned, setPinned] = useState(data.latest);
  const latest = pinned ?? data.latest;
  const notice = newVersionNotice(latest?.no ?? null, data.latest?.no ?? null);
  const body = latest ? (data.bodies[latest.no] ?? data.body) : data.body;
  const now = useMemo(() => new Date(data.nowIso), [data.nowIso]);
  const latestNo = latest?.no ?? null;

  // ---- center view -----------------------------------------------------------------------------
  const [initialView] = useState(() => defaultCenterView(data.lastSeenVersionNo, latestNo));
  const [view, setView] = useState<ScriptViewMode>(initialView.view);
  const [compareBase, setCompareBase] = useState<number | null>(initialView.base);
  const diffBase = compareBase ?? (latestNo !== null && latestNo > 1 ? latestNo - 1 : null);
  const canDiff = diffBase !== null && data.bodies[diffBase] !== undefined;
  const mode: ScriptViewMode = view === 'diff' && !canDiff ? 'read' : view;
  const centerTabs = [
    { id: 'read', label: latestNo !== null ? `v${latestNo} · aktuální` : 'Návrh' },
    ...(canDiff ? [{ id: 'diff', label: `Změny od v${diffBase}` }] : []),
    { id: 'dialog', label: 'Jen dialog' },
  ];

  // ---- sidebar / sheet -------------------------------------------------------------------------
  const [tab, setTab] = useState<SidebarTab>('comments');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | undefined>();
  const [scrollTo, setScrollTo] = useState<{ id: string } | null>(null);

  const activate = useCallback((id: string) => {
    setActiveId(id);
    setTab('comments');
    setScrollTo({ id });
  }, []);

  // ---- selection and composer ------------------------------------------------------------------
  const [selection, setSelection] = useState<{ anchor: NewAnchor; rect: DOMRect } | null>(null);
  const selectionRef = useRef(selection);
  useEffect(() => {
    selectionRef.current = selection;
  });
  const [target, setTarget] = useState<ComposerTarget>({ kind: 'general' });
  const [focusToken, setFocusToken] = useState(0);
  const [composerError, setComposerError] = useState<string | null>(null);
  const composerActive = useRef(false);
  const onComposerActive = useCallback((active: boolean) => {
    composerActive.current = active;
  }, []);

  // ---- dialogs and busy state ------------------------------------------------------------------
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<string[] | null>(null);
  const [busyCount, setBusyCount] = useState(0);
  const busy = busyCount > 0;
  const dialogOpen = returnOpen || blockers !== null;

  async function perform<T extends object>(
    promise: Promise<ActionResult<T>>,
    options: { silent?: boolean } = {},
  ): Promise<ActionResult<T>> {
    setBusyCount((n) => n + 1);
    try {
      const result = await promise;
      if (!result.ok && !options.silent) toast(result.message, 'error');
      if (!result.ok && result.code === 'STALE') router.refresh();
      return result;
    } finally {
      setBusyCount((n) => n - 1);
    }
  }

  // ---- remember what was seen ------------------------------------------------------------------
  const latestId = latest?.id;
  useEffect(() => {
    if (latestId) markSeenAction({ videoId: video.id, versionId: latestId }).catch(() => {});
  }, [video.id, latestId]);

  // ---- auto refresh ----------------------------------------------------------------------------
  const guards = useRef({ dialogOpen, busy });
  useEffect(() => {
    guards.current = { dialogOpen, busy };
  });
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (guards.current.dialogOpen || guards.current.busy || composerActive.current) return;
      if (isTypingTarget(document.activeElement)) return;
      const selected = window.getSelection();
      if (selected && !selected.isCollapsed) return;
      router.refresh();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [router]);

  // ---- deciding --------------------------------------------------------------------------------
  const line = approvalLine(data.approval, data.actor.name);

  function afterDecision(decision: 'approve' | 'return', result: Extract<ActionResult<{ state: 'approved' | 'returned' | 'pending'; waitingFor: string[] }>, { ok: true }>) {
    toast(decisionToast(decision, result));
    const next = nextUndecidedCode(data.queue, video.code);
    router.push(next ? `/kontrola/${next}${query}` : `/kontrola${query}`);
  }

  async function approve(override = false) {
    if (!latest || busy) return;
    const result = await perform(
      decideAction({ videoId: video.id, versionId: latest.id, decision: 'approve', overrideWarnings: override }),
      { silent: true },
    );
    if (result.ok) {
      setBlockers(null);
      afterDecision('approve', result);
    } else if (result.code === 'VALIDATION' && result.details.length > 0) {
      setBlockers(result.details);
    } else {
      setBlockers(null);
      toast(result.message, 'error');
    }
  }

  async function sendReturn(note: string) {
    if (!latest) return;
    setReturnError(null);
    const result = await perform(decideAction({ videoId: video.id, versionId: latest.id, decision: 'return', note }), { silent: true });
    if (result.ok) {
      setReturnOpen(false);
      afterDecision('return', result);
    } else {
      setReturnError(result.message);
    }
  }

  const askApprove = () => {
    if (perms.decide && !data.approval.actorApproved) void approve(false);
  };
  const askReturn = () => {
    if (!perms.decide) return;
    setReturnError(null);
    setReturnOpen(true);
  };

  // ---- comments --------------------------------------------------------------------------------
  const clearSelection = useCallback(() => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  function openComposer(next: ComposerTarget) {
    setTarget(next);
    setComposerError(null);
    setTab('comments');
    if (!desktop) setSheetOpen(true);
    setFocusToken((n) => n + 1);
    clearSelection();
  }

  const startComment = () => openComposer(selectionRef.current ? { kind: 'anchored', anchor: selectionRef.current.anchor } : { kind: 'general' });
  const startSuggestion = () => {
    if (!perms.suggest) return;
    if (!selectionRef.current) return toast('Nejdřív označ text, který chceš změnit.', 'error');
    openComposer({ kind: 'suggestion', anchor: selectionRef.current.anchor });
  };

  async function flagSelectedNumber() {
    const current = selectionRef.current;
    if (!current) return;
    clearSelection();
    const result = await perform(
      flagNumberAction({ videoId: video.id, fieldId: current.anchor.fieldId, quotedText: current.anchor.quotedText }),
    );
    if (result.ok) toast('Číslo označeno ke kontrole');
  }

  async function submitComment(input: ComposerSubmit): Promise<boolean> {
    setComposerError(null);
    const result = await perform(
      createCommentAction({
        videoId: video.id,
        versionId: latest?.id ?? null,
        type: input.type,
        body: input.body,
        mentions: input.mentions,
        ...(input.anchor ? { anchor: { fieldId: input.anchor.fieldId, from: input.anchor.from, to: input.anchor.to, quotedText: input.anchor.quotedText } } : {}),
        ...(input.replacement !== undefined ? { suggestion: { replacement: input.replacement } } : {}),
      }),
      { silent: true },
    );
    if (!result.ok) {
      setComposerError(result.message);
      return false;
    }
    toast(input.replacement !== undefined ? 'Návrh změny odeslán' : 'Komentář přidán');
    setTarget({ kind: 'general' });
    setSheetOpen(false);
    activate(result.id);
    return true;
  }

  const actions: CommentActions = {
    reply: async (threadId, body, mentions) => (await perform(replyToCommentAction({ parentId: threadId, body, mentions }))).ok,
    close: async (commentId) => (await perform(closeCommentAction({ commentId }))).ok,
    reopen: async (commentId) => (await perform(reopenCommentAction({ commentId }))).ok,
    address: async (commentId) => (await perform(markAddressedAction({ commentId }))).ok,
    accept: async (commentId) => {
      const result = await perform(decideSuggestionAction({ commentId, accept: true }));
      if (result.ok) toast('Návrh přijat · zapracuje se do další verze');
      return result.ok;
    },
    reject: async (commentId, reason) => (await perform(decideSuggestionAction({ commentId, accept: false, reason }))).ok,
  };

  // ---- keyboard (desktop) ----------------------------------------------------------------------
  const handlers = useRef({ askApprove, askReturn, startComment, startSuggestion });
  useEffect(() => {
    handlers.current = { askApprove, askReturn, startComment, startSuggestion };
  });
  const nav = useRef({ prev: data.prevCode, next: data.nextCode, query, dialogOpen });
  useEffect(() => {
    nav.current = { prev: data.prevCode, next: data.nextCode, query, dialogOpen };
  });
  useEffect(() => {
    if (!desktop) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      if (nav.current.dialogOpen) return;
      const go = (code: string | null) => code && router.push(`/kontrola/${code}${nav.current.query}`);
      switch (event.key.toLowerCase()) {
        case 'j':
          return void go(nav.current.next);
        case 'k':
          return void go(nav.current.prev);
        case 'c':
          event.preventDefault();
          return handlers.current.startComment();
        case 's':
          event.preventDefault();
          return handlers.current.startSuggestion();
        case 'a':
          return handlers.current.askApprove();
        case 'r':
          event.preventDefault();
          return handlers.current.askReturn();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [desktop, router]);

  // ---- derived view data -----------------------------------------------------------------------
  const anchored: AnchoredThread[] = useMemo(
    () =>
      data.threads.map((t) => ({
        id: t.id,
        index: t.index,
        anchor: t.anchor,
        suggestion: t.suggestion ? { replacement: t.suggestion.replacement, state: t.suggestion.state } : null,
        status: t.status,
        isDetached: t.isDetached,
      })),
    [data.threads],
  );
  const unresolved = unresolvedCount(data.threads);
  const { passed, total } = checkSummary(data.checks);
  const peekThread = data.threads.find((t) => t.id === activeId) ?? data.threads.find((t) => t.status === 'open') ?? data.threads[0];
  const nextHref = data.nextCode ? `/kontrola/${data.nextCode}${query}` : null;
  const selectable = perms.comment && mode === 'read' && !notice;

  const decideBar = (variant: 'inline' | 'fixed') => (
    <ActionBar
      variant={variant}
      canDecide={perms.decide}
      status={video.status}
      line={line}
      busy={busy}
      nextHref={nextHref}
      onApprove={askApprove}
      onReturn={askReturn}
    />
  );

  const cycleDate = data.cycle?.shootDate ? formatDayMonth(new Date(`${data.cycle.shootDate}T12:00:00Z`)) : null;

  return (
    // The layout's own bottom padding is cancelled so the total is exactly what the sheet and bar cover.
    <div className="-mb-28 flex flex-col gap-4 pb-[calc(288px+env(safe-area-inset-bottom))] md:-mb-10 lg:mb-0 lg:pb-0">
      {notice && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-inner bg-apricot-soft px-4 py-3 text-apricot-ink">
          <p className="min-w-0 flex-1 font-semibold">Mezitím vznikla nová verze v{notice.versionNo}</p>
          <Button
            variant="primary"
            onClick={() => {
              setPinned(data.latest);
              setCompareBase(notice.compareFrom);
              setView('diff');
            }}
          >
            Zobrazit změny
          </Button>
        </div>
      )}
      {/* Phone header: back, position, checks badge, progress. */}
      <header className="flex flex-col gap-3 lg:hidden">
        <div className="flex items-center gap-3">
          <Link href="/" aria-label="Zpět na přehled" className={cn('flex size-12 shrink-0 items-center justify-center rounded-full bg-card', focusRing)}>
            <ArrowLeft aria-hidden className="size-5" />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-label tracking-[0.12em] text-text2 uppercase">Ke kontrole</p>
            <p className="truncate font-semibold">
              {data.position !== null ? `${data.position} z ${data.queue.length}` : video.code}
              {cycleDate ? ` · natáčení ${cycleDate}` : ''}
            </p>
          </div>
          <button
            type="button"
            aria-label={`Kontrolní seznam, splněno ${passed} z ${total}`}
            onClick={() => {
              setTab('checks');
              setSheetOpen(true);
            }}
            className={cn('flex size-12 shrink-0 items-center justify-center rounded-full bg-ink font-semibold text-lime', focusRing)}
          >
            {passed}/{total}
          </button>
        </div>
        {data.position !== null && (
          <ol aria-label="Fronta" className="flex gap-1.5">
            {data.queue.map((item) => (
              <li key={item.videoId} className="min-w-0 flex-1">
                <Link
                  href={`/kontrola/${item.code}${query}`}
                  aria-label={`${item.code} ${item.title}`}
                  aria-current={item.code === video.code ? 'true' : undefined}
                  className={cn('block rounded-full py-3', focusRing)}
                >
                  <span
                    className={cn(
                      'block h-1.5 rounded-full',
                      item.code === video.code ? 'bg-violet' : item.decidedByActor ? 'bg-ink' : 'bg-ink/10',
                    )}
                  />
                </Link>
              </li>
            ))}
          </ol>
        )}
        <Tabs
          label="Zobrazení scénáře"
          items={centerTabs}
          value={mode}
          onChange={(id) => setView(id as ScriptViewMode)}
          className="w-full [&>button]:flex-1 [&>button]:px-2"
        />
      </header>

      <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)_340px] lg:items-start lg:gap-4">
        <div className="hidden lg:sticky lg:top-8 lg:block lg:h-[calc(100dvh-4rem)]">
          <QueueList queue={data.queue} activeCode={video.code} position={data.position} cycle={data.cycle} query={query} />
        </div>

        <section aria-label="Scénář" className="min-w-0 rounded-card bg-card p-5 lg:p-6">
          <div className="hidden flex-col gap-4 lg:sticky lg:top-0 lg:z-20 lg:-mx-6 lg:-mt-6 lg:mb-5 lg:flex lg:rounded-t-card lg:bg-card/95 lg:px-6 lg:pt-6 lg:pb-3 lg:backdrop-blur">
            <Tabs
              label="Zobrazení scénáře"
              items={centerTabs}
              value={mode}
              onChange={(id) => setView(id as ScriptViewMode)}
              className="w-fit"
            />
            {decideBar('inline')}
          </div>
          <ScriptView
            body={body}
            meta={data.meta}
            mode={mode}
            diffAgainst={diffBase !== null ? data.bodies[diffBase] : undefined}
            // Anchors belong to the newest text; on an older version they would point at the wrong words.
            threads={notice ? [] : anchored}
            hookTypeLabels={data.hookTypeLabels}
            activeCommentId={activeId}
            onSelectAnchor={selectable ? (anchor, rect) => setSelection({ anchor, rect }) : undefined}
            onSelectionClear={() => setSelection(null)}
            onAnchorClick={activate}
          />
        </section>

        <ReviewSidebar
          tab={tab}
          onTab={setTab}
          expanded={sheetOpen}
          onExpandedChange={setSheetOpen}
          commentCount={data.threads.length}
          unresolved={unresolved}
          approvalLineShown={line.text !== null}
          scrollTo={scrollTo}
          peek={
            peekThread ? (
              <CommentPreview
                thread={peekThread}
                onOpen={() => {
                  setSheetOpen(true);
                  activate(peekThread.id);
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => (perms.comment ? openComposer({ kind: 'general' }) : setSheetOpen(true))}
                className={cn('min-h-12 w-full rounded-inner bg-nest p-4 text-left text-text2', focusRing)}
              >
                Zatím žádné komentáře.{perms.comment ? ' Klepni a napiš první.' : ''}
              </button>
            )
          }
          composer={
            perms.comment ? (
              <Composer
                target={target}
                users={data.users}
                busy={busy}
                error={composerError}
                focusToken={focusToken}
                onCancelTarget={() => setTarget({ kind: 'general' })}
                onSubmit={submitComment}
                onActiveChange={onComposerActive}
              />
            ) : null
          }
        >
          {tab === 'comments' && (
            <CommentsPanel
              threads={data.threads}
              activeId={activeId}
              perms={perms}
              users={data.users}
              now={now}
              actions={actions}
              onActivate={activate}
            />
          )}
          {tab === 'checks' && (
            <ChecksPanel
              checks={data.checks}
              numberChecks={data.numberChecks}
              perms={perms}
              onToggleManual={async (code, checked) =>
                latest ? (await perform(setManualCheckAction({ videoId: video.id, versionId: latest.id, code, checked }))).ok : false
              }
              onConfirmNumber={async (id) => (await perform(confirmNumberAction({ numberCheckId: id }))).ok}
            />
          )}
          {tab === 'versions' && (
            <VersionsPanel
              versions={data.versions}
              latestNo={latestNo}
              onCompare={(no) => {
                setCompareBase(no);
                setView('diff');
                setSheetOpen(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}
        </ReviewSidebar>
      </div>

      {decideBar('fixed')}

      {selection && mode === 'read' && (
        <SelectionToolbar
          rect={selection.rect}
          canSuggest={perms.suggest}
          canNumber={perms.flagNumber}
          onComment={startComment}
          onSuggest={startSuggestion}
          onNumber={() => void flagSelectedNumber()}
        />
      )}

      {returnOpen && (
        <ReturnDialog
          open
          hasOwnComments={data.hasOwnCommentOnLatest}
          busy={busy}
          error={returnError}
          onSubmit={(note) => void sendReturn(note)}
          onCancel={() => setReturnOpen(false)}
        />
      )}
      <ConfirmDialog
        open={blockers !== null}
        blockers={blockers ?? []}
        busy={busy}
        onConfirm={() => void approve(true)}
        onCancel={() => setBlockers(null)}
      />
    </div>
  );
}
