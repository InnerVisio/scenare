import { getFieldText, setFieldText } from '@/domain/script/fields';
import type { ScriptBody } from '@/domain/script/types';
import { remapAnchor, type Anchor } from './remap';

export type ApplySuggestionResult =
  | { ok: true; body: ScriptBody; anchor: Anchor }
  | { ok: false; reason: 'stale' };

/**
 * Splices `replacement` over the anchored quote. The anchor is re-located first, so a suggestion
 * made against older text is never applied at stale offsets; if the quote is gone or was only
 * found approximately, it is refused.
 */
export function applySuggestion(
  body: ScriptBody,
  anchor: Anchor,
  replacement: string,
): ApplySuggestionResult {
  const located = remapAnchor(anchor, body);
  if (located.state === 'detached') return { ok: false, reason: 'stale' };
  const text = getFieldText(body, located.fieldId);
  if (text === undefined) return { ok: false, reason: 'stale' };
  // Only exact re-locations are safe to overwrite; a fuzzy hit may cover text the suggester never saw.
  if (text.slice(located.from, located.to) !== anchor.quotedText) return { ok: false, reason: 'stale' };
  const next = text.slice(0, located.from) + replacement + text.slice(located.to);
  return {
    ok: true,
    body: setFieldText(body, located.fieldId, next),
    anchor: {
      fieldId: located.fieldId,
      from: located.from,
      to: located.from + replacement.length,
      quotedText: replacement,
      state: 'attached',
    },
  };
}
