// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { domOffsetWithin, readSelection } from '@/app/(app)/_components/script-view/selection';

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body;
}

const FIELD =
  '<span data-field-id="line:a:text">Ke dni <span class="hl">konce</span> fixace<span data-nontext><button>12</button></span> bez poplatku.</span>';

describe('domOffsetWithin', () => {
  let field: Element;
  beforeEach(() => {
    mount(`<p><b>Honza</b> (nevzhlédne): ${FIELD}</p><p><span data-field-id="line:b:text">Druhá replika.</span></p>`);
    field = document.querySelector('[data-field-id="line:a:text"]')!;
  });

  it('counts characters inside a plain text node', () => {
    const first = field.firstChild!;
    expect(domOffsetWithin(field, first, 3)).toBe(3);
  });

  it('adds up text from preceding nested spans', () => {
    const hl = field.querySelector('.hl')!.firstChild!;
    expect(domOffsetWithin(field, hl, 2)).toBe('Ke dni '.length + 2);
  });

  it('ignores data-nontext content (badges) when counting later text', () => {
    const tail = field.lastChild!;
    expect(tail.textContent).toBe(' bez poplatku.');
    expect(domOffsetWithin(field, tail, 4)).toBe('Ke dni konce fixace'.length + 4);
  });

  it('maps a point inside a non-source subtree to the position right before it', () => {
    const badgeText = field.querySelector('button')!.firstChild!;
    expect(domOffsetWithin(field, badgeText, 1)).toBe('Ke dni konce fixace'.length);
  });

  it('handles element containers (child index)', () => {
    expect(domOffsetWithin(field, field, 0)).toBe(0);
    expect(domOffsetWithin(field, field, 2)).toBe('Ke dni konce'.length);
    expect(domOffsetWithin(field, field, field.childNodes.length)).toBe('Ke dni konce fixace bez poplatku.'.length);
  });

  it('clamps nodes outside the field to its start or end', () => {
    const before = document.querySelector('b')!.firstChild!;
    const after = document.querySelector('[data-field-id="line:b:text"]')!.firstChild!;
    expect(domOffsetWithin(field, before, 2)).toBe(0);
    expect(domOffsetWithin(field, after, 2)).toBe('Ke dni konce fixace bez poplatku.'.length);
  });
});

describe('readSelection', () => {
  beforeEach(() => {
    mount(`<p><b>Honza</b>: ${FIELD}</p><p><span data-field-id="line:b:text">Druhá replika.</span></p>`);
  });

  function select(startNode: Node, startOffset: number, endNode: Node, endOffset: number): Selection {
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    const sel = window.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(range);
    return sel;
  }

  it('reports field ids and source offsets for a selection inside one field', () => {
    const hl = document.querySelector('.hl')!.firstChild!;
    const tail = document.querySelector('[data-field-id="line:a:text"]')!.lastChild!;
    const sel = select(hl, 1, tail, 4);
    expect(readSelection(sel)).toEqual({
      startFieldId: 'line:a:text',
      startOffset: 'Ke dni k'.length,
      endFieldId: 'line:a:text',
      endOffset: 'Ke dni konce fixace'.length + 4,
    });
  });

  it('reports null field ids when an end sits in the speaker name', () => {
    const speaker = document.querySelector('b')!.firstChild!;
    const second = document.querySelector('[data-field-id="line:b:text"]')!.firstChild!;
    const sel = select(speaker, 1, second, 3);
    const result = readSelection(sel);
    expect(result.startFieldId).toBeNull();
    expect(result.endFieldId).toBe('line:b:text');
  });

  it('resolves element-level ends that wrap exactly one field', () => {
    const p = document.querySelectorAll('p')[1];
    const text = document.querySelector('[data-field-id="line:b:text"]')!.firstChild!;
    const sel = select(text, 0, p, 1);
    expect(readSelection(sel)).toMatchObject({
      endFieldId: 'line:b:text',
      endOffset: 'Druhá replika.'.length,
    });
  });

  it('snaps a paragraph-select end (offset 0 of the next line) to the end of the start field', () => {
    const start = document.querySelector('[data-field-id="line:a:text"]')!.firstChild!;
    const nextSpeaker = document.querySelectorAll('p')[1];
    const sel = select(start, 3, nextSpeaker, 0);
    expect(readSelection(sel)).toEqual({
      startFieldId: 'line:a:text',
      startOffset: 3,
      endFieldId: 'line:a:text',
      endOffset: 'Ke dni konce fixace bez poplatku.'.length,
    });
  });

  it('snaps when the end is a text node at offset 0 outside any field', () => {
    document.body.innerHTML = `<p><span data-field-id="line:a:text">Jedna.</span></p><p><b>Honza</b>: <span data-field-id="line:b:text">Dva.</span></p>`;
    const start = document.querySelector('[data-field-id="line:a:text"]')!.firstChild!;
    const speaker = document.querySelector('b')!.firstChild!;
    const sel = select(start, 0, speaker, 0);
    expect(readSelection(sel)).toMatchObject({ endFieldId: 'line:a:text', endOffset: 'Jedna.'.length });
  });

  it('does not snap when the previous field is not the start field', () => {
    document.body.innerHTML = `<p><span data-field-id="line:a:text">Jedna.</span></p><p><span data-field-id="line:b:text">Dva.</span></p><p><b>Honza</b></p>`;
    const start = document.querySelector('[data-field-id="line:a:text"]')!.firstChild!;
    const speaker = document.querySelector('b')!.firstChild!;
    const sel = select(start, 0, speaker, 0);
    expect(readSelection(sel).endFieldId).toBeNull();
  });
});
