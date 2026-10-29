import { describe, expect, it } from 'vitest';
import { buildSegments } from '@/app/(app)/_components/script-view/highlight';
import type { AnchoredThread } from '@/app/(app)/_components/script-view/types';

const FIELD = 'line:a:text';
const TEXT = 'Ke dni konce fixace splácíš bez poplatku. Ze zákona.';

function thread(index: number, from: number, to: number, extra: Partial<AnchoredThread> = {}): AnchoredThread {
  return {
    id: `t${index}`,
    index,
    anchor: { fieldId: FIELD, from, to, quotedText: TEXT.slice(from, to), state: 'attached' },
    suggestion: null,
    status: 'open',
    isDetached: false,
    ...extra,
  };
}

const view = (segments: ReturnType<typeof buildSegments>) =>
  segments.map((s) => [TEXT.slice(s.from, s.to), s.owner?.id ?? null, s.ends.map((t) => t.id)]);

describe('buildSegments', () => {
  it('returns one plain segment when nothing is anchored', () => {
    expect(view(buildSegments(TEXT, FIELD, []))).toEqual([[TEXT, null, []]]);
  });

  it('returns no segments for empty text', () => {
    expect(buildSegments('', FIELD, [thread(1, 0, 3)])).toEqual([]);
  });

  it('splits around a single range and marks the badge position', () => {
    const segs = view(buildSegments(TEXT, FIELD, [thread(1, 42, 52)]));
    expect(segs).toEqual([
      [TEXT.slice(0, 42), null, []],
      ['Ze zákona.', 't1', ['t1']],
    ]);
  });

  it('assigns overlapping text to the earliest-index thread and breaks the segment where the inner range ends', () => {
    const outer = thread(1, 0, 20);
    const inner = thread(2, 3, 12);
    const segs = view(buildSegments(TEXT, FIELD, [inner, outer]));
    expect(segs).toEqual([
      [TEXT.slice(0, 12), 't1', ['t2']],
      [TEXT.slice(12, 20), 't1', ['t1']],
      [TEXT.slice(20), null, []],
    ]);
  });

  it('lets a later partial overlap own only the part the earlier thread does not cover', () => {
    const segs = view(buildSegments(TEXT, FIELD, [thread(1, 0, 10), thread(2, 5, 15)]));
    expect(segs).toEqual([
      [TEXT.slice(0, 10), 't1', ['t1']],
      [TEXT.slice(10, 15), 't2', ['t2']],
      [TEXT.slice(15), null, []],
    ]);
  });

  it('keeps identical ranges as one segment with both badges in index order', () => {
    const segs = view(buildSegments(TEXT, FIELD, [thread(2, 0, 6), thread(1, 0, 6)]));
    expect(segs[0]).toEqual([TEXT.slice(0, 6), 't1', ['t1', 't2']]);
  });

  it('ignores closed, detached, other-field and unanchored threads', () => {
    const others: AnchoredThread[] = [
      thread(1, 0, 5, { status: 'closed' }),
      thread(2, 0, 5, { isDetached: true }),
      { ...thread(3, 0, 5), anchor: { fieldId: 'other', from: 0, to: 5, quotedText: 'x', state: 'attached' } },
      { ...thread(4, 0, 5), anchor: null },
      { ...thread(5, 0, 5), anchor: { fieldId: FIELD, from: 0, to: 5, quotedText: 'x', state: 'detached' } },
    ];
    expect(view(buildSegments(TEXT, FIELD, others))).toEqual([[TEXT, null, []]]);
  });

  it('highlights addressed threads (only closed ones disappear)', () => {
    expect(view(buildSegments(TEXT, FIELD, [thread(1, 0, 5, { status: 'addressed' })]))[0]).toEqual(['Ke dn', 't1', ['t1']]);
  });

  it('clamps out-of-range offsets and drops ranges that become empty', () => {
    const segs = view(buildSegments(TEXT, FIELD, [thread(1, 40, 9999), thread(2, 5000, 6000)]));
    expect(segs).toEqual([
      [TEXT.slice(0, 40), null, []],
      [TEXT.slice(40), 't1', ['t1']],
    ]);
  });
});
