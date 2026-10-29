// @vitest-environment jsdom
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FieldText } from '@/app/(app)/_components/script-view/FieldText';
import { ScriptView } from '@/app/(app)/_components/script-view/ScriptView';
import type { AnchoredThread, ScriptMeta } from '@/app/(app)/_components/script-view/types';
import { fixture } from '../domain/script/fixtures';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const meta: ScriptMeta = {
  code: 'V001',
  versionNo: 1,
  title: 'Test',
  categoryTag: { key: 'produkt', label: 'Produkt', colors: { color: '#fff', textColor: '#000' } },
  isTrialReel: false,
  durationSec: 21,
  locationLabels: [],
};

const thread: AnchoredThread = {
  id: 'c1',
  index: 1,
  anchor: { fieldId: 'line:l1:text', from: 0, to: 5, quotedText: 'Řádek', state: 'attached' },
  suggestion: null,
  status: 'open',
  isDetached: false,
};

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  // jsdom has no layout.
  Range.prototype.getBoundingClientRect = () => new DOMRect(10, 10, 50, 20);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  window.getSelection()?.removeAllRanges();
  vi.useRealTimers();
});

function selectInLine(fieldId: string, from: number, to: number) {
  const text = host.querySelector(`[data-field-id="${fieldId}"]`)!.firstChild!;
  const range = document.createRange();
  range.setStart(text, from);
  range.setEnd(text, to);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  document.dispatchEvent(new Event('selectionchange'));
  act(() => {
    vi.advanceTimersByTime(400);
  });
}

describe('ScriptView selection lifecycle', () => {
  const render = (props: { mode: 'read' | 'dialog' | 'diff'; onSelectAnchor?: () => void; onSelectionClear?: () => void }) =>
    act(() => {
      root.render(
        createElement(ScriptView, {
          body: fixture(),
          meta,
          threads: [],
          hookTypeLabels: {},
          diffAgainst: fixture(),
          ...props,
        }),
      );
    });

  it('clears the toolbar when the selectable mode ends while a selection is active', () => {
    const onSelectAnchor = vi.fn();
    const onSelectionClear = vi.fn();
    render({ mode: 'read', onSelectAnchor, onSelectionClear });
    selectInLine('line:l1:text', 0, 4);
    expect(onSelectAnchor).toHaveBeenCalledTimes(1);
    expect(onSelectionClear).not.toHaveBeenCalled();

    render({ mode: 'diff', onSelectAnchor, onSelectionClear });
    expect(onSelectionClear).toHaveBeenCalledTimes(1);
  });

  it('clears the toolbar on unmount while a selection is active', () => {
    const onSelectionClear = vi.fn();
    render({ mode: 'read', onSelectAnchor: vi.fn(), onSelectionClear });
    selectInLine('line:l1:text', 0, 4);
    act(() => root.unmount());
    expect(onSelectionClear).toHaveBeenCalledTimes(1);
    root = createRoot(host);
  });

  it('does not call onSelectionClear when nothing was selected', () => {
    const onSelectionClear = vi.fn();
    render({ mode: 'read', onSelectAnchor: vi.fn(), onSelectionClear });
    render({ mode: 'dialog', onSelectAnchor: vi.fn(), onSelectionClear });
    expect(onSelectionClear).not.toHaveBeenCalled();
  });
});

describe('FieldText click handling', () => {
  function mountField(onAnchorClick: (id: string) => void) {
    act(() => {
      root.render(
        createElement(FieldText, { fieldId: 'line:l1:text', text: 'Řádek 1 a něco dalšího', threads: [thread], onAnchorClick }),
      );
    });
  }

  function selectSomeText() {
    const text = host.querySelector('[data-field-id]')!.lastChild!;
    const range = document.createRange();
    range.setStart(text, 1);
    range.setEnd(text, 4);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
  }

  it('ignores a highlight click that ends a text selection', () => {
    const onAnchorClick = vi.fn();
    mountField(onAnchorClick);
    selectSomeText();
    act(() => host.querySelector<HTMLElement>('[data-thread-id="c1"]')!.click());
    expect(onAnchorClick).not.toHaveBeenCalled();
  });

  it('always lets the numbered badge through, even with a selection', () => {
    const onAnchorClick = vi.fn();
    mountField(onAnchorClick);
    selectSomeText();
    act(() => host.querySelector<HTMLElement>('button[aria-label="Komentář 1"]')!.click());
    expect(onAnchorClick).toHaveBeenCalledWith('c1');
  });

  it('handles a plain highlight click', () => {
    const onAnchorClick = vi.fn();
    mountField(onAnchorClick);
    window.getSelection()!.removeAllRanges();
    act(() => host.querySelector<HTMLElement>('[data-thread-id="c1"]')!.click());
    expect(onAnchorClick).toHaveBeenCalledWith('c1');
  });
});
