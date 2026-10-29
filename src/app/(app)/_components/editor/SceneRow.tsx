'use client';

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { Dispatch } from 'react';
import type { Cta, Scene } from '@/domain/script/types';
import type { EditorOptions } from '@/server/editorOptions';
import type { ThreadVM } from '@/server/review';
import { Button } from '@/ui/Button';
import { Field, TextInput, Textarea } from '@/ui/Field';
import { FieldThreads } from './FieldThreads';
import { IconButton } from './IconButton';
import { LineRow } from './LineRow';
import type { BodyAction } from './reducers';

const parseSeconds = (raw: string): number | null => (raw === '' ? null : Math.max(0, Math.round(Number(raw))));

export function SceneRow({
  scene,
  index,
  count,
  cta,
  ctaTypes,
  defaultCtaType,
  speakerListId,
  threadsByField,
  dispatch,
  onOpenThread,
}: {
  scene: Scene;
  index: number;
  count: number;
  cta: Cta | null;
  ctaTypes: EditorOptions['ctaTypes'];
  defaultCtaType: Cta['ctaType'];
  speakerListId: string;
  threadsByField: Map<string, ThreadVM[]>;
  dispatch: Dispatch<BodyAction>;
  onOpenThread: (threadId: string) => void;
}) {
  const seconds = (key: 'fromSec' | 'toSec', label: string) => (
    <Field label={label} className="w-24">
      <TextInput
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={scene[key] ?? ''}
        onChange={(event) => dispatch({ type: 'scene', sceneId: scene.id, patch: { [key]: parseSeconds(event.target.value) } })}
      />
    </Field>
  );

  return (
    <section aria-label={`Scéna ${index + 1}`} data-scene-id={scene.id} className="flex flex-col gap-4 rounded-card bg-card p-5 lg:p-6">
      <header className="flex flex-wrap items-end gap-3">
        <h3 className="text-h2 order-1 mr-auto self-center">Scéna {index + 1}</h3>
        <div className="order-3 flex w-full gap-3 sm:order-2 sm:w-auto">
          {seconds('fromSec', 'Od (s)')}
          {seconds('toSec', 'Do (s)')}
        </div>
        <div className="order-2 flex gap-1 sm:order-3">
          <IconButton label="Posunout scénu nahoru" className="bg-nest" disabled={index === 0} onClick={() => dispatch({ type: 'moveScene', sceneId: scene.id, dir: -1 })}>
            <ArrowUp aria-hidden className="size-5" />
          </IconButton>
          <IconButton label="Posunout scénu dolů" className="bg-nest" disabled={index === count - 1} onClick={() => dispatch({ type: 'moveScene', sceneId: scene.id, dir: 1 })}>
            <ArrowDown aria-hidden className="size-5" />
          </IconButton>
          <IconButton label="Smazat scénu" className="bg-nest" onClick={() => dispatch({ type: 'removeScene', sceneId: scene.id })}>
            <Trash2 aria-hidden className="size-5" />
          </IconButton>
        </div>
      </header>

      <Field label="Obraz">
        <Textarea
          placeholder="Co divák vidí"
          value={scene.visual}
          maxLength={2000}
          onChange={(event) => dispatch({ type: 'scene', sceneId: scene.id, patch: { visual: event.target.value } })}
        />
      </Field>
      <FieldThreads threads={threadsByField.get(`scene:${scene.id}:visual`)} onOpen={onOpenThread} />

      <ol className="flex flex-col gap-3">
        {scene.lines.map((line, i) => (
          <LineRow
            key={line.id}
            line={line}
            index={i}
            count={scene.lines.length}
            cta={cta?.lineId === line.id ? cta : null}
            ctaTypes={ctaTypes}
            defaultCtaType={defaultCtaType}
            speakerListId={speakerListId}
            threads={threadsByField.get(`line:${line.id}:text`)}
            dispatch={dispatch}
            onOpenThread={onOpenThread}
          />
        ))}
      </ol>
      <Button variant="outline" className="w-fit" onClick={() => dispatch({ type: 'addLine', sceneId: scene.id })}>
        <Plus aria-hidden className="size-4" />
        Replika
      </Button>
    </section>
  );
}
