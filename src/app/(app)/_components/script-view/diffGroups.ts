import type { FieldDiff } from '@/domain/diff/diffBodies';

/** Czech plural of „pole“: 1 pole, 2–4 pole, 5+ polí. */
export function unchangedFieldsLabel(count: number): string {
  const noun = count === 1 || (count >= 2 && count <= 4) ? 'pole' : 'polí';
  return `${count} ${noun} beze změny`;
}

export type DiffItem =
  | { kind: 'changed'; diff: FieldDiff }
  | { kind: 'same'; key: string; diffs: FieldDiff[] };

/** Consecutive unchanged fields become one collapsible item. */
export function groupDiffs(diffs: FieldDiff[]): DiffItem[] {
  const items: DiffItem[] = [];
  for (const diff of diffs) {
    if (diff.change !== 'same') {
      items.push({ kind: 'changed', diff });
      continue;
    }
    const last = items.at(-1);
    if (last?.kind === 'same') last.diffs.push(diff);
    else items.push({ kind: 'same', key: diff.fieldId, diffs: [diff] });
  }
  return items;
}
