import { describe, expect, it } from 'vitest';
import { selectionToAnchor } from '@/app/(app)/_components/script-view/selection';

const TEXTS: Record<string, string> = {
  'line:a:text': 'Ke dni konce fixace splácíš bez poplatku. Ze zákona.',
  'line:b:text': 'Jinde? To bych platil pokutu.',
};
const getText = (id: string) => TEXTS[id];

describe('selectionToAnchor', () => {
  it('maps a selection inside one field to an anchor with the quoted text', () => {
    const anchor = selectionToAnchor(
      { startFieldId: 'line:a:text', startOffset: 42, endFieldId: 'line:a:text', endOffset: 52 },
      getText,
    );
    expect(anchor).toEqual({ fieldId: 'line:a:text', from: 42, to: 52, quotedText: 'Ze zákona.' });
  });

  it('returns null when the selection spans two fields', () => {
    expect(
      selectionToAnchor({ startFieldId: 'line:a:text', startOffset: 3, endFieldId: 'line:b:text', endOffset: 5 }, getText),
    ).toBeNull();
  });

  it('returns null when either end is outside every field (speaker name, label)', () => {
    expect(selectionToAnchor({ startFieldId: null, startOffset: 0, endFieldId: 'line:a:text', endOffset: 5 }, getText)).toBeNull();
    expect(selectionToAnchor({ startFieldId: 'line:a:text', startOffset: 0, endFieldId: null, endOffset: 5 }, getText)).toBeNull();
    expect(selectionToAnchor({ startFieldId: null, startOffset: 0, endFieldId: null, endOffset: 0 }, getText)).toBeNull();
  });

  it('returns null for an unknown field', () => {
    expect(selectionToAnchor({ startFieldId: 'nope', startOffset: 0, endFieldId: 'nope', endOffset: 3 }, getText)).toBeNull();
  });

  it('swaps reversed offsets', () => {
    const anchor = selectionToAnchor(
      { startFieldId: 'line:a:text', startOffset: 12, endFieldId: 'line:a:text', endOffset: 3 },
      getText,
    );
    expect(anchor).toEqual({ fieldId: 'line:a:text', from: 3, to: 12, quotedText: 'dni konce' });
  });

  it('clamps offsets into [0, length]', () => {
    const text = TEXTS['line:b:text'];
    const anchor = selectionToAnchor(
      { startFieldId: 'line:b:text', startOffset: -7, endFieldId: 'line:b:text', endOffset: 9999 },
      getText,
    );
    expect(anchor).toEqual({ fieldId: 'line:b:text', from: 0, to: text.length, quotedText: text });
  });

  it('trims whitespace at both ends and keeps offsets in step with the quote', () => {
    const anchor = selectionToAnchor(
      { startFieldId: 'line:a:text', startOffset: 2, endFieldId: 'line:a:text', endOffset: 13 },
      getText,
    );
    expect(anchor).toEqual({ fieldId: 'line:a:text', from: 3, to: 12, quotedText: 'dni konce' });
    expect(TEXTS['line:a:text'].slice(anchor!.from, anchor!.to)).toBe(anchor!.quotedText);
  });

  it('returns null for whitespace-only or empty selections', () => {
    expect(selectionToAnchor({ startFieldId: 'line:a:text', startOffset: 2, endFieldId: 'line:a:text', endOffset: 3 }, getText)).toBeNull();
    expect(selectionToAnchor({ startFieldId: 'line:a:text', startOffset: 5, endFieldId: 'line:a:text', endOffset: 5 }, getText)).toBeNull();
  });

  it('returns null when both offsets are clamped away', () => {
    expect(
      selectionToAnchor({ startFieldId: 'line:b:text', startOffset: 500, endFieldId: 'line:b:text', endOffset: 900 }, getText),
    ).toBeNull();
  });
});
