import { describe, expect, it } from 'vitest';
import { remapAnchor, type Anchor } from '@/domain/anchors/remap';
import { setFieldText } from '@/domain/script/fields';
import { deepFreeze, fixture } from '../script/fixtures';

function anchorFor(text: string, quote: string, fieldId = 'line:l1:text', nth = 0): Anchor {
  let from = -1;
  for (let i = 0; i <= nth; i++) from = text.indexOf(quote, from + 1);
  return { fieldId, from, to: from + quote.length, quotedText: quote, state: 'attached' };
}

describe('remapAnchor', () => {
  it('(1) keeps the anchor unchanged when the text at the offsets still equals the quote', () => {
    const body = setFieldText(fixture(), 'line:l1:text', 'Stop! Neviděl jsi nabídku jinde?');
    const anchor = anchorFor('Stop! Neviděl jsi nabídku jinde?', 'nabídku');
    expect(remapAnchor(anchor, deepFreeze(body))).toEqual(anchor);
  });

  it('(1) reports attached even if the input anchor was detached', () => {
    const body = setFieldText(fixture(), 'line:l1:text', 'Stop! Neviděl jsi nabídku jinde?');
    const anchor = { ...anchorFor('Stop! Neviděl jsi nabídku jinde?', 'nabídku'), state: 'detached' as const };
    expect(remapAnchor(anchor, body).state).toBe('attached');
  });

  it('(2) follows the quote when text was inserted before it', () => {
    const old = 'Stop! Neviděl jsi nabídku jinde?';
    const anchor = anchorFor(old, 'nabídku');
    const next = 'Pozor! Stop! Neviděl jsi nabídku jinde?';
    const body = setFieldText(fixture(), 'line:l1:text', next);
    const out = remapAnchor(anchor, body);
    expect(out).toEqual({
      fieldId: 'line:l1:text',
      from: next.indexOf('nabídku'),
      to: next.indexOf('nabídku') + 'nabídku'.length,
      quotedText: 'nabídku',
      state: 'attached',
    });
  });

  it('(2) duplicate quote picks the occurrence nearest to the old offset', () => {
    const old = 'Ze zákona. Opravdu. Ze zákona.';
    const second = anchorFor(old, 'Ze zákona.', 'line:l1:text', 1);
    const first = anchorFor(old, 'Ze zákona.', 'line:l1:text', 0);
    // Text shifts so neither occurrence sits at its old offset.
    const next = 'Prý: Ze zákona. Opravdu. Ze zákona.';
    const body = setFieldText(fixture(), 'line:l1:text', next);
    const firstIdx = next.indexOf('Ze zákona.');
    const secondIdx = next.lastIndexOf('Ze zákona.');
    expect(remapAnchor(second, body).from).toBe(secondIdx);
    expect(remapAnchor(first, body).from).toBe(firstIdx);
  });

  it('(3) finds the quote in another field (first in reading order) when the field was edited', () => {
    let body = setFieldText(fixture(), 'line:l1:text', 'Nic tu není');
    body = setFieldText(body, 'line:l3:text', 'Tady je kvóta navíc');
    body = setFieldText(body, 'caption', 'Také kvóta');
    const anchor: Anchor = {
      fieldId: 'line:l1:text',
      from: 3,
      to: 8,
      quotedText: 'kvóta',
      state: 'attached',
    };
    const out = remapAnchor(anchor, body);
    expect(out).toEqual({
      fieldId: 'line:l3:text',
      from: 'Tady je '.length,
      to: 'Tady je kvóta'.length,
      quotedText: 'kvóta',
      state: 'attached',
    });
  });

  it('(3) finds the quote in another field when the original field was deleted', () => {
    const body = fixture();
    body.scenes[0].lines = body.scenes[0].lines.filter((l) => l.id !== 'l1');
    body.scenes[1].lines[0].text = 'Řádek 3 s výrazem fixace';
    const anchor: Anchor = {
      fieldId: 'line:l1:text',
      from: 0,
      to: 6,
      quotedText: 'fixace',
      state: 'attached',
    };
    const out = remapAnchor(anchor, body);
    expect(out.fieldId).toBe('line:l3:text');
    expect(out.state).toBe('attached');
    expect(body.scenes[1].lines[0].text.slice(out.from, out.to)).toBe('fixace');
  });

  it('(4) fuzzy-matches a slightly edited quote in the same field', () => {
    const old = 'Banka ti nabídne sazbu jen když o ni požádáš';
    const anchor = anchorFor(old, 'nabídne sazbu jen když');
    const next = 'Banka ti nabídne sazbu jenom když o ni požádáš';
    const body = setFieldText(fixture(), 'line:l1:text', next);
    const out = remapAnchor(anchor, body);
    expect(out.state).toBe('attached');
    expect(out.fieldId).toBe('line:l1:text');
    expect(out.from).toBe(next.indexOf('nabídne'));
    expect(out.to).toBeLessThanOrEqual(next.length);
    expect(out.quotedText).toBe('nabídne sazbu jen když');
  });

  it('(4) does not fuzzy-match quotes shorter than 4 characters', () => {
    const anchor: Anchor = { fieldId: 'line:l1:text', from: 0, to: 3, quotedText: 'xyz', state: 'attached' };
    const body = setFieldText(fixture(), 'line:l1:text', 'xya');
    expect(remapAnchor(anchor, body).state).toBe('detached');
  });

  it('(4) clamps the fuzzy end to the text length', () => {
    const anchor: Anchor = {
      fieldId: 'line:l1:text',
      from: 0,
      to: 20,
      quotedText: 'Stop a poslouchej mě',
      state: 'attached',
    };
    const body = setFieldText(fixture(), 'line:l1:text', 'Stop a poslouchej');
    const out = remapAnchor(anchor, body);
    if (out.state === 'attached') expect(out.to).toBeLessThanOrEqual('Stop a poslouchej'.length);
  });

  it('(5) detaches when nothing matches, keeping field and offsets', () => {
    const anchor: Anchor = {
      fieldId: 'line:l1:text',
      from: 2,
      to: 9,
      quotedText: 'hypotéka',
      state: 'attached',
    };
    const body = setFieldText(fixture(), 'line:l1:text', 'Úplně jiný obsah řádku');
    expect(remapAnchor(anchor, body)).toEqual({ ...anchor, state: 'detached' });
  });

  it('detaches when the field was deleted and no other field has the quote', () => {
    const body = fixture();
    body.scenes[0].lines = body.scenes[0].lines.filter((l) => l.id !== 'l1');
    const anchor: Anchor = {
      fieldId: 'line:l1:text',
      from: 0,
      to: 7,
      quotedText: 'Nikdekoliv',
      state: 'attached',
    };
    expect(remapAnchor(anchor, body)).toEqual({ ...anchor, state: 'detached' });
  });

  it('detaches an empty quote', () => {
    const anchor: Anchor = { fieldId: 'line:l1:text', from: 0, to: 0, quotedText: '', state: 'attached' };
    expect(remapAnchor(anchor, fixture()).state).toBe('detached');
  });

  it('does not mutate its inputs', () => {
    const body = deepFreeze(fixture());
    const anchor = deepFreeze({
      fieldId: 'line:l1:text',
      from: 0,
      to: 3,
      quotedText: 'Řád',
      state: 'attached' as const,
    });
    expect(() => remapAnchor(anchor, body)).not.toThrow();
  });
});
