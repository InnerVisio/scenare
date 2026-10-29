import DiffMatchPatch from 'diff-match-patch';
import { getFieldText, listFields } from '@/domain/script/fields';
import type { FieldId, ScriptBody } from '@/domain/script/types';

export interface Anchor {
  fieldId: FieldId;
  from: number;
  to: number;
  quotedText: string;
  state: 'attached' | 'detached';
}

const FUZZY_MIN_QUOTE = 4;
const FUZZY_THRESHOLD = 0.4;
/** diff-match-patch cannot match patterns longer than its bit width (32). */
const FUZZY_MAX_PATTERN = 32;

function occurrences(text: string, quote: string): number[] {
  const found: number[] = [];
  let i = text.indexOf(quote);
  while (i !== -1) {
    found.push(i);
    i = text.indexOf(quote, i + 1);
  }
  return found;
}

function nearest(candidates: number[], target: number): number {
  return candidates.reduce((best, c) => (Math.abs(c - target) < Math.abs(best - target) ? c : best));
}

function attachedAt(anchor: Anchor, fieldId: FieldId, from: number, to: number): Anchor {
  return { fieldId, from, to, quotedText: anchor.quotedText, state: 'attached' };
}

/**
 * Re-locates `anchor` in `body`. Order: unchanged offsets, nearest exact occurrence in the same
 * field, first exact occurrence in another field, fuzzy match in the same field, else detached.
 * Never throws and never produces offsets outside the field text.
 */
export function remapAnchor(anchor: Anchor, body: ScriptBody): Anchor {
  const quote = anchor.quotedText;
  const detached: Anchor = { ...anchor, state: 'detached' };
  if (!quote) return detached;

  const text = getFieldText(body, anchor.fieldId);

  if (text !== undefined) {
    if (text.slice(anchor.from, anchor.to) === quote) {
      return { ...anchor, state: 'attached' };
    }
    const same = occurrences(text, quote);
    if (same.length > 0) {
      const from = nearest(same, anchor.from);
      return attachedAt(anchor, anchor.fieldId, from, from + quote.length);
    }
  }

  for (const field of listFields(body)) {
    if (field.fieldId === anchor.fieldId) continue;
    const idx = field.text.indexOf(quote);
    if (idx !== -1) return attachedAt(anchor, field.fieldId, idx, idx + quote.length);
  }

  if (text !== undefined && quote.length >= FUZZY_MIN_QUOTE && text.length > 0) {
    const dmp = new DiffMatchPatch();
    dmp.Match_Threshold = FUZZY_THRESHOLD;
    const idx = dmp.match_main(text, quote.slice(0, FUZZY_MAX_PATTERN), anchor.from);
    if (idx !== -1) {
      return attachedAt(anchor, anchor.fieldId, idx, Math.min(idx + quote.length, text.length));
    }
  }

  return detached;
}
