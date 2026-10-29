import { describe, expect, it } from 'vitest';
import { emptyScript } from '@/domain/script/template';

describe('emptyScript', () => {
  it('has hooks A and B, empty', () => {
    expect(emptyScript().hooks).toEqual([
      { id: 'A', hookType: null, text: '', visual: '' },
      { id: 'B', hookType: null, text: '', visual: '' },
    ]);
  });

  it('has three scenes with timings and one empty line each', () => {
    const { scenes } = emptyScript();
    expect(scenes.map((s) => [s.fromSec, s.toSec])).toEqual([
      [0, 2],
      [2, null],
      [null, null],
    ]);
    for (const s of scenes) {
      expect(s.visual).toBe('');
      expect(s.lines).toHaveLength(1);
      expect(s.lines[0]).toMatchObject({ speaker: '', direction: '', text: '' });
    }
  });

  it('has unique ids across scenes and lines', () => {
    const { scenes } = emptyScript();
    const ids = scenes.flatMap((s) => [s.id, ...s.lines.map((l) => l.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has default cta, texts and hashtags', () => {
    const b = emptyScript();
    expect(b.cta).toBeNull();
    expect(b.hashtags).toEqual(['#vaskonzultant']);
    expect([b.caption, b.viewerLearns, b.source, b.differsFromLast3]).toEqual(['', '', '', '']);
  });

  it('returns a fresh object each call', () => {
    expect(emptyScript()).not.toBe(emptyScript());
    expect(emptyScript().scenes[0].id).not.toBe(emptyScript().scenes[0].id);
  });
});
