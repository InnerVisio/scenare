import type { AnchoredThread } from './types';

export interface Segment {
  from: number;
  to: number;
  /** Thread whose highlight this text belongs to (earliest index among overlapping ones), or null for plain text. */
  owner: AnchoredThread | null;
  /** Threads whose range ends exactly at `to`, in index order: their badge (and replacement) follows this segment. */
  ends: AnchoredThread[];
}

interface Range {
  thread: AnchoredThread;
  from: number;
  to: number;
}

function rangesFor(text: string, fieldId: string, threads: AnchoredThread[]): Range[] {
  const ranges: Range[] = [];
  for (const thread of threads) {
    const a = thread.anchor;
    if (!a || a.state !== 'attached' || thread.isDetached || thread.status === 'closed') continue;
    if (a.fieldId !== fieldId) continue;
    const from = Math.min(Math.max(a.from, 0), text.length);
    const to = Math.min(Math.max(a.to, 0), text.length);
    if (from < to) ranges.push({ thread, from, to });
  }
  return ranges.sort((x, y) => x.thread.index - y.thread.index);
}

/**
 * Splits `text` into consecutive segments that cover it completely. Overlaps never nest: each piece
 * of text belongs to the earliest-index thread covering it. Neighbouring pieces with the same owner
 * are merged unless a thread's range ends between them (its badge needs that position).
 */
export function buildSegments(text: string, fieldId: string, threads: AnchoredThread[]): Segment[] {
  if (text.length === 0) return [];
  const ranges = rangesFor(text, fieldId, threads);
  const cuts = new Set<number>([0, text.length]);
  for (const r of ranges) {
    cuts.add(r.from);
    cuts.add(r.to);
  }
  const points = [...cuts].sort((a, b) => a - b);

  const segments: Segment[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const from = points[i];
    const to = points[i + 1];
    const owner = ranges.find((r) => r.from <= from && r.to >= to)?.thread ?? null;
    const ends = ranges.filter((r) => r.to === to).map((r) => r.thread);
    const last = segments.at(-1);
    if (last && last.owner === owner && last.ends.length === 0) {
      last.to = to;
      last.ends = ends;
    } else {
      segments.push({ from, to, owner, ends });
    }
  }
  return segments;
}
