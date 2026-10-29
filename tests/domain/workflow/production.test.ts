import { describe, expect, it } from 'vitest';
import { PRODUCTION_STATUSES, PRODUCTION_STATUS_LABELS } from '@/domain/workflow/production';

describe('production statuses', () => {
  it('lists statuses in workflow order', () => {
    expect([...PRODUCTION_STATUSES]).toEqual([
      'waiting',
      'shot',
      'editing',
      'edited',
      'published',
      'not_shot',
    ]);
  });
  it('has exact Czech labels', () => {
    expect(PRODUCTION_STATUS_LABELS).toEqual({
      waiting: 'Čeká na natáčení',
      shot: 'Natočeno',
      editing: 'Ve střihu',
      edited: 'Sestříháno',
      published: 'Publikováno',
      not_shot: 'Nenatočeno',
    });
  });
});
