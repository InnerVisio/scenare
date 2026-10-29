'use client';

import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import type { Dispatch } from 'react';
import type { Line, Cta } from '@/domain/script/types';
import type { EditorOptions } from '@/server/editorOptions';
import type { ThreadVM } from '@/server/review';
import { cn, focusRing } from '@/ui/cn';
import { Select, TextInput, Textarea } from '@/ui/Field';
import { FieldThreads } from './FieldThreads';
import { IconButton } from './IconButton';
import type { BodyAction } from './reducers';

/** One spoken line: speaker (with suggestions), acting note, text, and the „Výzva“ mark. */
export function LineRow({
  line,
  index,
  count,
  cta,
  ctaTypes,
  defaultCtaType,
  speakerListId,
  threads,
  dispatch,
  onOpenThread,
}: {
  line: Line;
  index: number;
  count: number;
  /** The script's call to action when it is on this line. */
  cta: Cta | null;
  ctaTypes: EditorOptions['ctaTypes'];
  defaultCtaType: Cta['ctaType'];
  speakerListId: string;
  threads: ThreadVM[] | undefined;
  dispatch: Dispatch<BodyAction>;
  onOpenThread: (threadId: string) => void;
}) {
  return (
    <li aria-label={`Replika ${index + 1}`} data-line-id={line.id} className="flex flex-col gap-3 rounded-inner bg-nest p-3 sm:p-4">
      <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
        <TextInput
          aria-label="Mluví"
          placeholder="Mluví"
          list={speakerListId}
          value={line.speaker}
          maxLength={80}
          onChange={(event) => dispatch({ type: 'line', lineId: line.id, patch: { speaker: event.target.value } })}
          className="bg-card"
        />
        <TextInput
          aria-label="Poznámka k hraní"
          placeholder="Poznámka k hraní, např. do kamery"
          value={line.direction}
          maxLength={120}
          onChange={(event) => dispatch({ type: 'line', lineId: line.id, patch: { direction: event.target.value } })}
          className="bg-card"
        />
      </div>
      <Textarea
        aria-label="Text repliky"
        placeholder="Co řekne"
        value={line.text}
        maxLength={2000}
        onChange={(event) => dispatch({ type: 'line', lineId: line.id, patch: { text: event.target.value } })}
        className="bg-card text-script"
      />
      <FieldThreads threads={threads} onOpen={onOpenThread} />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={cta !== null}
          onClick={() => dispatch({ type: 'toggleCta', lineId: line.id, defaultType: defaultCtaType })}
          className={cn(
            'min-h-12 rounded-pill px-5 font-semibold',
            focusRing,
            cta ? 'bg-lime-soft text-lime-ink' : 'bg-card text-ink hover:bg-ink/5',
          )}
        >
          Výzva
        </button>
        {cta && (
          <Select
            aria-label="Typ výzvy"
            value={cta.ctaType}
            onChange={(event) => dispatch({ type: 'ctaType', ctaType: event.target.value as Cta['ctaType'] })}
            pill
            className="w-auto bg-card"
          >
            {ctaTypes.map((type) => (
              <option key={type.key} value={type.key}>
                {type.label}
              </option>
            ))}
          </Select>
        )}
        <div className="ml-auto flex gap-1">
          <IconButton label="Posunout repliku nahoru" disabled={index === 0} onClick={() => dispatch({ type: 'moveLine', lineId: line.id, dir: -1 })}>
            <ArrowUp aria-hidden className="size-5" />
          </IconButton>
          <IconButton label="Posunout repliku dolů" disabled={index === count - 1} onClick={() => dispatch({ type: 'moveLine', lineId: line.id, dir: 1 })}>
            <ArrowDown aria-hidden className="size-5" />
          </IconButton>
          <IconButton label="Smazat repliku" onClick={() => dispatch({ type: 'removeLine', lineId: line.id })}>
            <Trash2 aria-hidden className="size-5" />
          </IconButton>
        </div>
      </div>
    </li>
  );
}
