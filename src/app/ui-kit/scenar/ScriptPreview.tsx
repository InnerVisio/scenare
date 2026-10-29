'use client';

import { useState } from 'react';
import { SelectionToolbar } from '@/app/(app)/_components/script-view/SelectionToolbar';
import { ScriptView } from '@/app/(app)/_components/script-view/ScriptView';
import type { AnchoredThread, NewAnchor, ScriptMeta, ScriptViewMode } from '@/app/(app)/_components/script-view/types';
import type { ScriptBody } from '@/domain/script/types';
import { Card } from '@/ui/Card';
import { Tabs } from '@/ui/Tabs';

const MODES = [
  { id: 'read', label: 'v2 · aktuální' },
  { id: 'diff', label: 'Změny od v1' },
  { id: 'dialog', label: 'Jen dialog' },
];

export function ScriptPreview({
  body,
  previousBody,
  meta,
  threads,
  hookTypeLabels,
}: {
  body: ScriptBody;
  previousBody: ScriptBody | undefined;
  meta: ScriptMeta;
  threads: AnchoredThread[];
  hookTypeLabels: Record<string, string>;
}) {
  const [mode, setMode] = useState<ScriptViewMode>('read');
  const [activeId, setActiveId] = useState<string | undefined>();
  const [selection, setSelection] = useState<{ anchor: NewAnchor; rect: DOMRect } | null>(null);

  const log = (action: string) => console.log(`[script-view] ${action}`, selection?.anchor);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6 md:py-10">
      <Tabs
        label="Režim zobrazení"
        items={MODES}
        value={mode}
        onChange={(id) => {
          setMode(id as ScriptViewMode);
          setSelection(null);
        }}
      />
      <Card className="md:p-8">
        <ScriptView
          body={body}
          meta={meta}
          mode={mode}
          diffAgainst={previousBody}
          threads={threads}
          hookTypeLabels={hookTypeLabels}
          activeCommentId={activeId}
          onSelectAnchor={(anchor, rect) => setSelection({ anchor, rect })}
          onSelectionClear={() => setSelection(null)}
          onAnchorClick={(id) => setActiveId((current) => (current === id ? undefined : id))}
        />
      </Card>
      {selection && (
        <SelectionToolbar
          rect={selection.rect}
          canSuggest
          canNumber
          onComment={() => log('komentovat')}
          onSuggest={() => log('navrhnout')}
          onNumber={() => log('číslo')}
        />
      )}
    </main>
  );
}
