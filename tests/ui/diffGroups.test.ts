import { describe, expect, it } from 'vitest';
import { groupDiffs, unchangedFieldsLabel } from '@/app/(app)/_components/script-view/diffGroups';
import type { FieldDiff } from '@/domain/diff/diffBodies';

const diff = (fieldId: string, change: FieldDiff['change']): FieldDiff => ({ fieldId, label: fieldId, change, parts: [{ value: fieldId }] });

describe('unchangedFieldsLabel', () => {
  it('uses Czech plural forms of „pole“', () => {
    expect(unchangedFieldsLabel(1)).toBe('1 pole beze změny');
    expect(unchangedFieldsLabel(3)).toBe('3 pole beze změny');
    expect(unchangedFieldsLabel(5)).toBe('5 polí beze změny');
    expect(unchangedFieldsLabel(12)).toBe('12 polí beze změny');
  });
});

describe('groupDiffs', () => {
  it('collapses consecutive unchanged fields into one item', () => {
    const items = groupDiffs([diff('a', 'same'), diff('b', 'same'), diff('c', 'changed'), diff('d', 'same'), diff('e', 'added'), diff('f', 'removed')]);
    expect(items.map((i) => (i.kind === 'same' ? `same:${i.diffs.length}` : i.diff.fieldId))).toEqual(['same:2', 'c', 'same:1', 'e', 'f']);
  });
});
