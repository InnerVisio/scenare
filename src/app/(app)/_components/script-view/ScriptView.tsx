'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { getFieldText } from '@/domain/script/fields';
import type { Hook, Line, Scene, ScriptBody } from '@/domain/script/types';
import { cn } from '@/ui/cn';
import { DiffView } from './DiffView';
import { FieldText, type FieldTone } from './FieldText';
import { ScriptHeader } from './ScriptHeader';
import { readSelection, selectionToAnchor } from './selection';
import type { AnchoredThread, NewAnchor, ScriptMeta, ScriptViewMode } from './types';

export type { AnchoredThread, NewAnchor, ScriptMeta, ScriptViewMode } from './types';

/** Wait for the selection to stop changing (touch handles fire `selectionchange` continuously). */
const SELECTION_SETTLE_MS = 300;

function sceneTime(scene: Scene): string {
  if (scene.fromSec === null && scene.toSec === null) return 'čas nevyplněn';
  return `${scene.fromSec ?? '?'}–${scene.toSec ?? '?'} s`;
}

const EMPTY = <span className="text-text2 italic">nevyplněno</span>;

export interface ScriptViewProps {
  body: ScriptBody;
  meta: ScriptMeta;
  mode: ScriptViewMode;
  /** Previous version's body; the comparison base for `mode="diff"`. */
  diffAgainst?: ScriptBody;
  threads: AnchoredThread[];
  /** Hook type key → label, for the „A · Problém v obraze“ card headers. */
  hookTypeLabels: Record<string, string>;
  activeCommentId?: string;
  /** Called (after the selection settles) with a valid anchor and the selection's viewport rectangle. */
  onSelectAnchor?: (anchor: NewAnchor, rect: DOMRect) => void;
  /** Called when there is no longer a usable selection, so the parent can hide its toolbar. */
  onSelectionClear?: () => void;
  onAnchorClick?: (commentId: string) => void;
}

export function ScriptView({
  body,
  meta,
  mode,
  diffAgainst,
  threads,
  hookTypeLabels,
  activeCommentId,
  onSelectAnchor,
  onSelectionClear,
  onAnchorClick,
}: ScriptViewProps) {
  const rootRef = useRef<HTMLElement>(null);
  const latest = useRef({ body, onSelectAnchor, onSelectionClear });
  useEffect(() => {
    latest.current = { body, onSelectAnchor, onSelectionClear };
  });

  const selectable = mode !== 'diff' && Boolean(onSelectAnchor);

  useEffect(() => {
    if (!selectable) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let frame = 0;
    let active = false;

    const clear = () => {
      if (!active) return;
      active = false;
      latest.current.onSelectionClear?.();
    };

    const evaluate = () => {
      const root = rootRef.current;
      const sel = window.getSelection();
      if (!root || !sel || sel.rangeCount === 0 || sel.isCollapsed) return clear();
      const range = sel.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) return clear();
      const anchor = selectionToAnchor(readSelection(sel), (id) => getFieldText(latest.current.body, id));
      if (!anchor) return clear();
      active = true;
      latest.current.onSelectAnchor?.(anchor, range.getBoundingClientRect());
    };

    const onChange = () => {
      clearTimeout(timer);
      timer = setTimeout(evaluate, SELECTION_SETTLE_MS);
    };
    // Keep the toolbar glued to the selection while the page (or any scroll container) moves.
    const onScroll = () => {
      if (!active) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(evaluate);
    };

    document.addEventListener('selectionchange', onChange);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      document.removeEventListener('selectionchange', onChange);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [selectable]);

  const field = (fieldId: string, text: string, opts: { tone?: FieldTone; className?: string } = {}) => (
    <FieldText
      fieldId={fieldId}
      text={text}
      threads={threads}
      activeThreadId={activeCommentId}
      onAnchorClick={onAnchorClick}
      tone={opts.tone}
      className={opts.className}
    />
  );

  const lineRow = (line: Line) => (
    <p key={line.id} className="text-script break-words">
      {line.speaker && <b className="font-semibold select-none">{line.speaker}</b>}
      {line.direction && <span className="text-text2 select-none"> ({line.direction})</span>}
      {line.speaker && <b className="font-semibold select-none">:</b>}
      {line.speaker && ' '}
      {field(`line:${line.id}:text`, line.text)}
    </p>
  );

  if (mode === 'diff') {
    return (
      <article ref={rootRef} className="flex flex-col gap-6" data-mode="diff">
        <ScriptHeader meta={meta} />
        <DiffView body={body} prev={diffAgainst} />
      </article>
    );
  }

  if (mode === 'dialog') {
    const scenes = body.scenes.filter((scene) => scene.lines.length > 0);
    return (
      <article ref={rootRef} className="flex flex-col gap-6" data-mode="dialog">
        {scenes.length === 0 && <p className="rounded-inner bg-nest p-4 text-text2">Scénář zatím nemá žádné repliky.</p>}
        {scenes.map((scene) => (
          <section key={scene.id} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-text2">
              Scéna {body.scenes.indexOf(scene) + 1} · {sceneTime(scene)}
            </h2>
            {scene.lines.map(lineRow)}
          </section>
        ))}
      </article>
    );
  }

  return (
    <article ref={rootRef} className="flex flex-col gap-7" data-mode="read">
      <ScriptHeader meta={meta} />

      <section aria-label="Co se divák dozví" className="rounded-inner bg-ink p-5 text-card md:p-6">
        <h2 className="text-h2 tracking-wide text-lime uppercase">Co se divák dozví</h2>
        <p className="text-script mt-2">
          {body.viewerLearns ? field('viewerLearns', body.viewerLearns, { tone: 'dark' }) : EMPTY}
        </p>
        <p className="mt-1 text-card/60">
          <span className="select-none">Zdroj: </span>
          {body.source ? field('source', body.source, { tone: 'dark' }) : EMPTY}
        </p>
      </section>

      <section aria-label="Hook" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <h2 className="text-h2">Hook (0–2 s)</h2>
          {body.hooks.length > 1 && <p className="text-sm text-text2">A/B točit v jednom zátahu</p>}
        </div>
        {body.hooks.length === 0 ? (
          <p className="text-text2">Hook zatím není vyplněný.</p>
        ) : (
          <div className={cn('grid gap-3', body.hooks.length > 2 ? 'md:grid-cols-3' : body.hooks.length > 1 && 'md:grid-cols-2')}>
            {body.hooks.map((hook, i) => (
              <HookCard key={hook.id} hook={hook} primary={i === 0} typeLabel={hook.hookType ? hookTypeLabels[hook.hookType] : undefined} field={field} />
            ))}
          </div>
        )}
      </section>

      <section aria-label="Scény" className="flex flex-col">
        <h2 className="text-h2 mb-3">Scény</h2>
        {body.scenes.length === 0 && <p className="border-t border-ink/10 pt-4 text-text2">Scény zatím nejsou vyplněné.</p>}
        <ol>
          {body.scenes.map((scene, i) => (
            <li key={scene.id} className="grid gap-x-6 gap-y-2 border-t border-ink/10 py-5 md:grid-cols-[88px_1fr]">
              <p className="flex items-baseline justify-between text-sm font-semibold text-text2 md:block">
                <span className="md:hidden">Scéna {i + 1}</span>
                <span>{sceneTime(scene)}</span>
              </p>
              <div className="flex min-w-0 flex-col gap-3">
                {scene.visual && (
                  <p className="text-script break-words text-text2">
                    <span className="select-none">Obraz: </span>
                    {field(`scene:${scene.id}:visual`, scene.visual)}
                  </p>
                )}
                {scene.lines.map((line) => (
                  <div key={line.id} className="flex flex-col gap-2">
                    {body.cta?.lineId === line.id && (
                      <span className="inline-flex w-fit items-center rounded-pill bg-[#E6F59A] px-3 py-1.5 text-sm leading-none font-semibold text-[#3F5A00] select-none">
                        Výzva{meta.ctaLabel ? ` · ${meta.ctaLabel}` : ''}
                      </span>
                    )}
                    {lineRow(line)}
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="Titulek" className="border-t border-ink/10 pt-5">
        <h2 className="text-h2">Titulek</h2>
        <p className="text-script mt-2 break-words">{body.caption ? field('caption', body.caption) : EMPTY}</p>
        {body.hashtags.length > 0 && <p className="mt-2 font-medium break-words text-violet">{body.hashtags.join(' ')}</p>}
      </section>

      {body.differsFromLast3 && (
        <section aria-label="Čím se liší od posledních 3 videí" className="rounded-inner bg-nest p-4">
          <h2 className="text-sm font-semibold text-text2">Čím se liší od posledních 3 videí</h2>
          <p className="text-script mt-1 break-words">{field('differsFromLast3', body.differsFromLast3)}</p>
        </section>
      )}
    </article>
  );
}

function HookCard({
  hook,
  primary,
  typeLabel,
  field,
}: {
  hook: Hook;
  primary: boolean;
  typeLabel: string | undefined;
  field: (fieldId: string, text: string, opts?: { tone?: FieldTone; className?: string }) => ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-2 rounded-inner p-4', primary ? 'border-2 border-ink bg-card' : 'bg-nest')}>
      <p className="text-sm font-semibold text-ink2 select-none">
        {hook.id}
        {typeLabel ? ` · ${typeLabel}` : ''}
      </p>
      {hook.visual ? <p className="text-script break-words">{field(`hook:${hook.id}:visual`, hook.visual)}</p> : null}
      {hook.text ? (
        <p className="text-script break-words italic">
          <span className="select-none">„</span>
          {field(`hook:${hook.id}:text`, hook.text)}
          <span className="select-none">“</span>
        </p>
      ) : null}
      {!hook.visual && !hook.text && <p className="text-text2 italic">nevyplněno</p>}
    </div>
  );
}

