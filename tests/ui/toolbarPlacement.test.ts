import { describe, expect, it } from 'vitest';
import { placeToolbar } from '@/app/(app)/_components/script-view/toolbarPlacement';

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height }) as DOMRect;

const viewport = { width: 390, height: 844 };
const size = { width: 300, height: 56 };

describe('placeToolbar', () => {
  it('sits above the selection with a 12 px gap on fine pointers', () => {
    const pos = placeToolbar({ rect: rect(100, 300, 80, 24), size, viewport, coarse: false });
    expect(pos.top).toBe(300 - 56 - 12);
  });

  it('sits below the selection with a 28 px gap on coarse pointers', () => {
    const pos = placeToolbar({ rect: rect(100, 300, 80, 24), size, viewport, coarse: true });
    expect(pos.top).toBe(324 + 28);
  });

  it('flips above when a coarse pointer leaves no room below', () => {
    const pos = placeToolbar({ rect: rect(100, 790, 80, 24), size, viewport, coarse: true });
    expect(pos.top).toBe(790 - 56 - 28);
  });

  it('flips below when a fine pointer leaves no room above', () => {
    const pos = placeToolbar({ rect: rect(100, 10, 80, 24), size, viewport, coarse: false });
    expect(pos.top).toBe(34 + 12);
  });

  it('centres on the selection and clamps horizontally', () => {
    expect(placeToolbar({ rect: rect(150, 300, 100, 24), size, viewport, coarse: false }).left).toBe(200 - 150);
    expect(placeToolbar({ rect: rect(0, 300, 20, 24), size, viewport, coarse: false }).left).toBe(8);
    expect(placeToolbar({ rect: rect(380, 300, 10, 24), size, viewport, coarse: false }).left).toBe(390 - 300 - 8);
  });
});
