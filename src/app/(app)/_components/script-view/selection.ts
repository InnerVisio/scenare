import type { NewAnchor } from './types';

export interface RawSelection {
  startFieldId: string | null;
  startOffset: number;
  endFieldId: string | null;
  endOffset: number;
}

const FIELD_SELECTOR = '[data-field-id]';
const NONTEXT_ATTR = 'data-nontext';

/**
 * Pure mapping from a DOM selection (already reduced to field ids and source offsets) to an anchor.
 * Null when the ends are in different fields or outside a field (speaker name, labels), or when the
 * trimmed range is empty. Offsets are clamped to the field text and never leave `[0, length]`.
 */
export function selectionToAnchor(
  sel: RawSelection,
  getText: (fieldId: string) => string | undefined,
): NewAnchor | null {
  if (sel.startFieldId === null || sel.endFieldId === null) return null;
  if (sel.startFieldId !== sel.endFieldId) return null;
  const text = getText(sel.startFieldId);
  if (text === undefined) return null;

  const clamp = (n: number) => Math.min(Math.max(Math.trunc(n) || 0, 0), text.length);
  let from = clamp(sel.startOffset);
  let to = clamp(sel.endOffset);
  if (from > to) [from, to] = [to, from];
  while (from < to && /\s/.test(text[from])) from++;
  while (to > from && /\s/.test(text[to - 1])) to--;
  if (from >= to) return null;
  return { fieldId: sel.startFieldId, from, to, quotedText: text.slice(from, to) };
}

function isNonText(node: Node): boolean {
  return node.nodeType === Node.ELEMENT_NODE && (node as Element).hasAttribute(NONTEXT_ATTR);
}

/**
 * Source-text offset of the DOM point (`node`, `offset`) inside `fieldEl`. Only text nodes outside
 * `[data-nontext]` subtrees count (badges and suggestion replacements are rendered inside the field
 * but are not part of its text). A point inside such a subtree maps to the position right before it;
 * points outside the field clamp to its start or end.
 */
export function domOffsetWithin(fieldEl: Element, node: Node, offset: number): number {
  if (node !== fieldEl && !fieldEl.contains(node)) {
    const before = Boolean(node.compareDocumentPosition(fieldEl) & Node.DOCUMENT_POSITION_FOLLOWING);
    return before ? 0 : sourceLength(fieldEl);
  }
  let total = 0;
  let found = false;

  const visit = (current: Node): void => {
    if (found) return;
    if (isNonText(current)) {
      if (current === node || current.contains(node)) found = true;
      return;
    }
    if (current.nodeType === Node.TEXT_NODE) {
      const length = (current as Text).data.length;
      if (current === node) {
        total += Math.min(Math.max(offset, 0), length);
        found = true;
      } else {
        total += length;
      }
      return;
    }
    if (current === node) {
      const children = Array.from(current.childNodes).slice(0, Math.max(offset, 0));
      for (const child of children) visit(child);
      found = true;
      return;
    }
    for (const child of Array.from(current.childNodes)) visit(child);
  };

  visit(fieldEl);
  return total;
}

function sourceLength(fieldEl: Element): number {
  let total = 0;
  const walk = (n: Node) => {
    if (isNonText(n)) return;
    if (n.nodeType === Node.TEXT_NODE) total += (n as Text).data.length;
    else n.childNodes.forEach(walk);
  };
  walk(fieldEl);
  return total;
}

function fieldOf(node: Node): Element | null {
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  return el?.closest(FIELD_SELECTOR) ?? null;
}

/**
 * Resolves one end of a range. Ends in a text node (the normal case, also on touch handles) are
 * inside a field or not. An end on an element outside any field (e.g. after dragging past the end
 * of a line) is accepted only when the adjacent child holds exactly one field, which then counts as
 * fully selected up to that edge.
 */
function resolveEnd(node: Node, offset: number, isStart: boolean): { fieldId: string | null; offset: number } {
  const field = fieldOf(node);
  if (field) return { fieldId: field.getAttribute('data-field-id'), offset: domOffsetWithin(field, node, offset) };

  if (node.nodeType === Node.ELEMENT_NODE) {
    const edge = isStart ? node.childNodes[offset] : node.childNodes[offset - 1];
    if (edge && edge.nodeType === Node.ELEMENT_NODE) {
      const el = edge as Element;
      const fields = el.matches(FIELD_SELECTOR) ? [el] : Array.from(el.querySelectorAll(FIELD_SELECTOR));
      if (fields.length === 1) {
        return { fieldId: fields[0].getAttribute('data-field-id'), offset: isStart ? 0 : sourceLength(fields[0]) };
      }
    }
  }
  return { fieldId: null, offset: 0 };
}

export function readSelection(sel: Selection): RawSelection {
  if (sel.rangeCount === 0) return { startFieldId: null, startOffset: 0, endFieldId: null, endOffset: 0 };
  const range = sel.getRangeAt(0);
  const start = resolveEnd(range.startContainer, range.startOffset, true);
  const end = resolveEnd(range.endContainer, range.endOffset, false);
  return { startFieldId: start.fieldId, startOffset: start.offset, endFieldId: end.fieldId, endOffset: end.offset };
}
