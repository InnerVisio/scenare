import { diffWordsWithSpace } from 'diff';
import { fieldLabel, getFieldText, listFields } from '@/domain/script/fields';
import type { FieldId, ScriptBody } from '@/domain/script/types';

export interface DiffPart {
  value: string;
  added?: boolean;
  removed?: boolean;
}

export interface FieldDiff {
  fieldId: FieldId;
  label: string;
  change: 'added' | 'removed' | 'changed' | 'same';
  parts: DiffPart[];
}

/** Field order of `next`; fields only in `prev` are inserted right after their predecessor. */
function mergedOrder(prev: ScriptBody, next: ScriptBody): FieldId[] {
  const order = listFields(next).map((f) => f.fieldId);
  const inOrder = new Set(order);
  const prevIds = listFields(prev).map((f) => f.fieldId);
  prevIds.forEach((id, i) => {
    if (inOrder.has(id)) return;
    let at = 0;
    for (let j = i - 1; j >= 0; j--) {
      const pos = order.indexOf(prevIds[j]);
      if (pos !== -1) {
        at = pos + 1;
        break;
      }
    }
    order.splice(at, 0, id);
    inOrder.add(id);
  });
  return order;
}

export function diffBodies(prev: ScriptBody, next: ScriptBody): FieldDiff[] {
  return mergedOrder(prev, next).map((fieldId): FieldDiff => {
    const before = getFieldText(prev, fieldId);
    const after = getFieldText(next, fieldId);
    if (before === undefined && after !== undefined) {
      return {
        fieldId,
        label: fieldLabel(next, fieldId),
        change: 'added',
        parts: [{ value: after, added: true }],
      };
    }
    if (before !== undefined && after === undefined) {
      return {
        fieldId,
        label: fieldLabel(prev, fieldId),
        change: 'removed',
        parts: [{ value: before, removed: true }],
      };
    }
    const label = fieldLabel(next, fieldId);
    if (before === after) {
      return { fieldId, label, change: 'same', parts: [{ value: after ?? '' }] };
    }
    const parts = diffWordsWithSpace(before ?? '', after ?? '').map((c): DiffPart => {
      const part: DiffPart = { value: c.value };
      if (c.added) part.added = true;
      if (c.removed) part.removed = true;
      return part;
    });
    return { fieldId, label, change: 'changed', parts };
  });
}
