'use client';

import { useMemo, useState } from 'react';
import { diffBodies, type DiffPart, type FieldDiff } from '@/domain/diff/diffBodies';
import type { ScriptBody } from '@/domain/script/types';
import { cn, focusRing } from '@/ui/cn';
import { groupDiffs, unchangedFieldsLabel } from './diffGroups';

function Parts({ parts }: { parts: DiffPart[] }) {
  return (
    <>
      {parts.map((part, i) =>
        part.added ? (
          <ins key={i} className="rounded-[6px] bg-lime/70 px-0.5 text-ink no-underline box-decoration-clone">
            {part.value}
          </ins>
        ) : part.removed ? (
          <del key={i} className="rounded-[6px] bg-danger-bg px-0.5 text-danger-text line-through decoration-1 box-decoration-clone">
            {part.value}
          </del>
        ) : (
          <span key={i}>{part.value}</span>
        ),
      )}
    </>
  );
}

function FieldBlock({ diff, muted }: { diff: FieldDiff; muted?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-semibold text-text2">{diff.label}</p>
      <p className={cn('text-script break-words', muted && 'text-text2')}>
        {diff.parts.every((p) => p.value === '') ? <span className="text-text2 italic">prázdné</span> : <Parts parts={diff.parts} />}
      </p>
    </div>
  );
}

/** Field-by-field comparison with the previous version; no anchors or selection here. */
export function DiffView({ body, prev }: { body: ScriptBody; prev: ScriptBody | undefined }) {
  const items = useMemo(() => (prev ? groupDiffs(diffBodies(prev, body)) : []), [prev, body]);
  const [open, setOpen] = useState<Set<string>>(new Set());

  if (!prev) {
    return <p className="rounded-inner bg-nest p-4 text-text2">K porovnání není žádná předchozí verze.</p>;
  }
  if (items.every((item) => item.kind === 'same')) {
    return <p className="rounded-inner bg-nest p-4 text-text2">Oproti předchozí verzi se nic nezměnilo.</p>;
  }

  return (
    <section aria-label="Změny oproti předchozí verzi" className="flex flex-col gap-4">
      {items.map((item) => {
        if (item.kind === 'changed') return <FieldBlock key={item.diff.fieldId} diff={item.diff} />;
        const expanded = open.has(item.key);
        return (
          <div key={item.key} className="flex flex-col gap-4">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() =>
                setOpen((current) => {
                  const next = new Set(current);
                  if (next.has(item.key)) next.delete(item.key);
                  else next.add(item.key);
                  return next;
                })
              }
              className={cn(
                'min-h-12 w-full rounded-inner bg-nest px-4 text-left text-sm font-semibold text-text2 hover:text-ink',
                focusRing,
              )}
            >
              {unchangedFieldsLabel(item.diffs.length)}
              <span className="ml-2 font-normal">{expanded ? '· skrýt' : '· zobrazit'}</span>
            </button>
            {expanded && item.diffs.map((diff) => <FieldBlock key={diff.fieldId} diff={diff} muted />)}
          </div>
        );
      })}
    </section>
  );
}
