import { describe, expect, it } from 'vitest';
import type { Anchor } from '@/domain/anchors/remap';
import { applySuggestion } from '@/domain/anchors/suggestion';
import { getFieldText, setFieldText } from '@/domain/script/fields';
import { deepFreeze, fixture } from '../script/fixtures';

const ORIGINAL = 'Stop! Neviděl jsi nabídku jinde?';
const REPLACEMENT = 'Počkej. Kolik ti nabídli jinde?';

function setup() {
  const body = setFieldText(fixture(), 'line:l1:text', ORIGINAL);
  const anchor: Anchor = {
    fieldId: 'line:l1:text',
    from: 0,
    to: ORIGINAL.length,
    quotedText: ORIGINAL,
    state: 'attached',
  };
  return { body, anchor };
}

describe('applySuggestion', () => {
  it('replaces the quoted text and returns an anchor covering the replacement', () => {
    const { body, anchor } = setup();
    const res = applySuggestion(deepFreeze(body), deepFreeze(anchor), REPLACEMENT);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(getFieldText(res.body, 'line:l1:text')).toBe(REPLACEMENT);
    expect(res.anchor).toEqual({
      fieldId: 'line:l1:text',
      from: 0,
      to: REPLACEMENT.length,
      quotedText: REPLACEMENT,
      state: 'attached',
    });
  });

  it('keeps the surrounding text when only part of the line is quoted', () => {
    const { body } = setup();
    const anchor: Anchor = {
      fieldId: 'line:l1:text',
      from: 0,
      to: 5,
      quotedText: 'Stop!',
      state: 'attached',
    };
    const res = applySuggestion(body, anchor, 'Počkej.');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(getFieldText(res.body, 'line:l1:text')).toBe('Počkej. Neviděl jsi nabídku jinde?');
    expect(res.anchor.to).toBe('Počkej.'.length);
  });

  it('re-locates the quote after an earlier edit instead of splicing at old offsets', () => {
    const { body, anchor } = setup();
    const edited = setFieldText(body, 'line:l1:text', `Pozor. ${ORIGINAL}`);
    const res = applySuggestion(edited, anchor, REPLACEMENT);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(getFieldText(res.body, 'line:l1:text')).toBe(`Pozor. ${REPLACEMENT}`);
    expect(res.anchor.from).toBe('Pozor. '.length);
    expect(res.anchor.to).toBe('Pozor. '.length + REPLACEMENT.length);
  });

  it('is stale when the quote is no longer present', () => {
    const { body, anchor } = setup();
    const edited = setFieldText(body, 'line:l1:text', 'Úplně přepsaný text bez původní věty');
    const res = applySuggestion(edited, anchor, REPLACEMENT);
    expect(res).toEqual({ ok: false, reason: 'stale' });
  });

  it('is stale when the field was deleted', () => {
    const { body, anchor } = setup();
    body.scenes[0].lines = body.scenes[0].lines.filter((l) => l.id !== 'l1');
    expect(applySuggestion(body, anchor, REPLACEMENT)).toEqual({ ok: false, reason: 'stale' });
  });

  it('does not mutate the input body', () => {
    const { body, anchor } = setup();
    deepFreeze(body);
    expect(() => applySuggestion(body, anchor, REPLACEMENT)).not.toThrow();
    expect(getFieldText(body, 'line:l1:text')).toBe(ORIGINAL);
  });
});
