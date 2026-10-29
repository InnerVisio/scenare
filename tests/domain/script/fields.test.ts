import { describe, expect, it } from 'vitest';
import { fieldLabel, getFieldText, listFields, setFieldText } from '@/domain/script/fields';
import { deepFreeze, fixture } from './fixtures';

describe('listFields', () => {
  it('returns fields in reading order', () => {
    const ids = listFields(fixture()).map((f) => f.fieldId);
    expect(ids).toEqual([
      'viewerLearns',
      'source',
      'hook:A:text',
      'hook:A:visual',
      'hook:B:text',
      'hook:B:visual',
      'scene:s1:visual',
      'line:l1:text',
      'line:l2:text',
      'scene:s2:visual',
      'line:l3:text',
      'line:l4:text',
      'scene:s3:visual',
      'line:l5:text',
      'caption',
      'differsFromLast3',
    ]);
  });

  it('includes label and current text', () => {
    const f = listFields(fixture()).find((x) => x.fieldId === 'hook:B:visual');
    expect(f).toEqual({ fieldId: 'hook:B:visual', label: 'Hook B · obraz', text: 'Hook B obraz' });
  });
});

describe('getFieldText / setFieldText', () => {
  it('round-trips every field kind', () => {
    const body = fixture();
    for (const { fieldId } of listFields(body)) {
      const next = setFieldText(body, fieldId, `NEW ${fieldId}`);
      expect(getFieldText(next, fieldId)).toBe(`NEW ${fieldId}`);
    }
  });

  it('only changes the targeted field', () => {
    const body = fixture();
    const next = setFieldText(body, 'line:l3:text', 'X');
    const changed = listFields(next).filter((f, i) => f.text !== listFields(body)[i].text);
    expect(changed.map((f) => f.fieldId)).toEqual(['line:l3:text']);
  });

  it('does not mutate the input', () => {
    const body = deepFreeze(fixture());
    const snapshot = JSON.stringify(body);
    for (const { fieldId } of listFields(body)) {
      setFieldText(body, fieldId, 'changed');
    }
    expect(JSON.stringify(body)).toBe(snapshot);
  });

  it('returns undefined for unknown or missing fields on get', () => {
    const body = fixture();
    expect(getFieldText(body, 'nope')).toBeUndefined();
    expect(getFieldText(body, 'hook:C:text')).toBeUndefined();
    expect(getFieldText(body, 'line:zzz:text')).toBeUndefined();
    expect(getFieldText(body, 'scene:zzz:visual')).toBeUndefined();
  });

  it('throws on unknown field on set', () => {
    const body = fixture();
    expect(() => setFieldText(body, 'nope', 'x')).toThrow(Error);
    expect(() => setFieldText(body, 'hook:C:text', 'x')).toThrow(Error);
    expect(() => setFieldText(body, 'line:zzz:text', 'x')).toThrow(Error);
    expect(() => setFieldText(body, 'scene:zzz:visual', 'x')).toThrow(Error);
  });
});

describe('fieldLabel', () => {
  it('labels all field kinds in Czech', () => {
    const body = fixture();
    expect(fieldLabel(body, 'hook:A:text')).toBe('Hook A · text');
    expect(fieldLabel(body, 'hook:A:visual')).toBe('Hook A · obraz');
    expect(fieldLabel(body, 'scene:s2:visual')).toBe('Scéna 2 · obraz');
    expect(fieldLabel(body, 'line:l1:text')).toBe('Scéna 1 · Radek');
    expect(fieldLabel(body, 'line:l3:text')).toBe('Scéna 2 · Radek');
    expect(fieldLabel(body, 'line:l4:text')).toBe('Scéna 2 · replika');
    expect(fieldLabel(body, 'caption')).toBe('Titulek');
    expect(fieldLabel(body, 'viewerLearns')).toBe('Co se divák dozví');
    expect(fieldLabel(body, 'source')).toBe('Zdroj');
    expect(fieldLabel(body, 'differsFromLast3')).toBe('Čím se liší od posledních 3 videí');
  });

  it('throws on unknown field', () => {
    expect(() => fieldLabel(fixture(), 'nope')).toThrow(Error);
  });
});
