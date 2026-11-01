import { describe, expect, it } from 'vitest';
import { checkProductionChange } from '@/domain/workflow/production';

const base = { code: 'V001', approvalStatus: 'approved', publications: 0 };

describe('checkProductionChange', () => {
  it('allows shooting statuses on an approved script', () => {
    for (const to of ['shot', 'not_shot', 'editing', 'edited', 'waiting']) {
      expect(checkProductionChange({ ...base, to })).toBeNull();
    }
  });
  it('refuses anything but waiting on a script that is not approved', () => {
    expect(checkProductionChange({ ...base, approvalStatus: 'in_review', to: 'shot' })).toBe(
      'V001 není schválený, výrobu lze měnit jen u schválených scénářů.',
    );
    expect(checkProductionChange({ ...base, approvalStatus: 'draft', to: 'waiting' })).toBeNull();
  });
  it('refuses Publikováno without a publication', () => {
    expect(checkProductionChange({ ...base, to: 'published' })).toBe('V001: stav Publikováno vyžaduje alespoň jednu publikaci.');
    expect(checkProductionChange({ ...base, to: 'published', publications: 1 })).toBeNull();
  });
  it('refuses an unknown status', () => {
    expect(checkProductionChange({ ...base, to: 'nope' })).toBe('Neznámý stav výroby.');
  });
});
