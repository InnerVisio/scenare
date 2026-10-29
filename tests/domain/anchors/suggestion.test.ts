import { describe, expect, it } from 'vitest';
import { remapAnchor, type Anchor } from '@/domain/anchors/remap';
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

  it('is stale when the quote can only be located fuzzily, and leaves the body untouched', () => {
    const old = 'Banka ti nabídne sazbu jen když o ni požádáš';
    const anchor: Anchor = {
      fieldId: 'line:l1:text',
      from: old.indexOf('nabídne'),
      to: old.indexOf('nabídne') + 'nabídne sazbu jen když'.length,
      quotedText: 'nabídne sazbu jen když',
      state: 'attached',
    };
    const edited = deepFreeze(
      setFieldText(fixture(), 'line:l1:text', 'Banka ti nabídne sazbu jenom když o ni požádáš'),
    );
    // Precondition: remapAnchor does find it fuzzily.
    expect(remapAnchor(anchor, edited).state).toBe('attached');
    const res = applySuggestion(edited, anchor, 'něco jiného');
    expect(res).toEqual({ ok: false, reason: 'stale' });
    expect(getFieldText(edited, 'line:l1:text')).toBe('Banka ti nabídne sazbu jenom když o ni požádáš');
  });

  it('still applies when the exact quote moved to a different field', () => {
    const { body, anchor } = setup();
    let edited = setFieldText(body, 'line:l1:text', 'Úplně přepsaný text');
    edited = setFieldText(edited, 'caption', `Titulek: ${ORIGINAL}`);
    const res = applySuggestion(edited, anchor, REPLACEMENT);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.anchor.fieldId).toBe('caption');
    expect(getFieldText(res.body, 'caption')).toBe(`Titulek: ${REPLACEMENT}`);
    expect(getFieldText(res.body, 'line:l1:text')).toBe('Úplně přepsaný text');
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
