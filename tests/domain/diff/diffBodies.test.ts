import { describe, expect, it } from 'vitest';
import { diffBodies } from '@/domain/diff/diffBodies';
import { listFields, setFieldText } from '@/domain/script/fields';
import { deepFreeze, fixture } from '../script/fixtures';

describe('diffBodies', () => {
  it('marks every field same for identical bodies', () => {
    const body = fixture();
    const diff = diffBodies(deepFreeze(body), fixture());
    expect(diff.map((d) => d.fieldId)).toEqual(listFields(body).map((f) => f.fieldId));
    for (const d of diff) {
      expect(d.change).toBe('same');
      expect(d.parts).toHaveLength(1);
      expect(d.parts[0].added).toBeUndefined();
      expect(d.parts[0].removed).toBeUndefined();
    }
  });

  it('produces removed + added parts for a changed line', () => {
    const prev = fixture();
    const next = setFieldText(prev, 'line:l1:text', 'Řádek ZMĚNA');
    const d = diffBodies(prev, next).find((x) => x.fieldId === 'line:l1:text')!;
    expect(d.change).toBe('changed');
    expect(d.label).toBe('Scéna 1 · Radek');
    expect(d.parts.some((p) => p.removed && p.value.includes('1'))).toBe(true);
    expect(d.parts.some((p) => p.added && p.value.includes('ZMĚNA'))).toBe(true);
    expect(d.parts.filter((p) => !p.added && !p.removed).map((p) => p.value).join('')).toContain('Řádek');
    // reconstructing: non-added parts = prev, non-removed parts = next
    expect(d.parts.filter((p) => !p.added).map((p) => p.value).join('')).toBe('Řádek 1');
    expect(d.parts.filter((p) => !p.removed).map((p) => p.value).join('')).toBe('Řádek ZMĚNA');
  });

  it('marks fields of a new scene as added', () => {
    const prev = fixture();
    const next = fixture();
    next.scenes.push({
      id: 's4',
      fromSec: 21,
      toSec: 25,
      visual: 'Nová scéna',
      lines: [{ id: 'l6', speaker: 'Radek', direction: '', text: 'Nový řádek' }],
    });
    const diff = diffBodies(prev, next);
    const visual = diff.find((d) => d.fieldId === 'scene:s4:visual')!;
    const line = diff.find((d) => d.fieldId === 'line:l6:text')!;
    expect(visual.change).toBe('added');
    expect(visual.parts).toEqual([{ value: 'Nová scéna', added: true }]);
    expect(line.change).toBe('added');
    expect(line.label).toBe('Scéna 4 · Radek');
    expect(diff.filter((d) => d.change !== 'added').every((d) => d.change === 'same')).toBe(true);
  });

  it('marks a deleted line as removed, placed after its predecessor', () => {
    const prev = fixture();
    const next = fixture();
    next.scenes[0].lines = next.scenes[0].lines.filter((l) => l.id !== 'l1');
    const diff = diffBodies(prev, next);
    const ids = diff.map((d) => d.fieldId);
    const removed = diff.find((d) => d.fieldId === 'line:l1:text')!;
    expect(removed.change).toBe('removed');
    expect(removed.parts).toEqual([{ value: 'Řádek 1', removed: true }]);
    expect(removed.label).toBe('Scéna 1 · Radek');
    expect(ids.indexOf('line:l1:text')).toBe(ids.indexOf('scene:s1:visual') + 1);
    expect(ids.indexOf('line:l2:text')).toBe(ids.indexOf('line:l1:text') + 1);
  });

  it('places a removed first field at the start', () => {
    const prev = fixture();
    const next = fixture();
    next.hooks = next.hooks.filter((h) => h.id !== 'B');
    const diff = diffBodies(prev, next);
    const ids = diff.map((d) => d.fieldId);
    expect(ids.indexOf('hook:B:text')).toBe(ids.indexOf('hook:A:visual') + 1);
    expect(diff.filter((d) => d.change === 'removed').map((d) => d.fieldId)).toEqual([
      'hook:B:text',
      'hook:B:visual',
    ]);
  });

  it('does not mutate inputs', () => {
    expect(() => diffBodies(deepFreeze(fixture()), deepFreeze(fixture()))).not.toThrow();
  });
});
