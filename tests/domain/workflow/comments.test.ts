import { describe, expect, it } from 'vitest';
import {
  COMMENT_STATUSES,
  COMMENT_STATUS_LABELS,
  COMMENT_TYPES,
  COMMENT_TYPE_LABELS,
  initialCommentStatus,
  nextCommentStatus,
  type CommentStatus,
} from '@/domain/workflow/comments';
import { WorkflowTransitionError } from '@/domain/workflow/errors';

type Event = 'address' | 'close' | 'reopen';

describe('comment labels', () => {
  it('has Czech status labels', () => {
    expect(COMMENT_STATUS_LABELS).toEqual({
      open: 'Nevyřešeno',
      addressed: 'Zapracováno',
      closed: 'Uzavřeno',
    });
  });
  it('has Czech type labels for every type', () => {
    expect(COMMENT_TYPE_LABELS).toEqual({
      remark: 'Připomínka',
      expert: 'Odborné doplnění',
      change_request: 'Požadavek na úpravu',
      idea: 'Nápad',
      approval: 'Souhlas / schválení',
    });
    expect(Object.keys(COMMENT_TYPE_LABELS)).toEqual([...COMMENT_TYPES]);
  });
});

describe('nextCommentStatus', () => {
  const valid: [CommentStatus, Event, CommentStatus][] = [
    ['open', 'address', 'addressed'],
    ['open', 'close', 'closed'],
    ['addressed', 'close', 'closed'],
    ['addressed', 'reopen', 'open'],
    ['closed', 'reopen', 'open'],
  ];
  const invalid: [CommentStatus, Event][] = [
    ['open', 'reopen'],
    ['addressed', 'address'],
    ['closed', 'address'],
    ['closed', 'close'],
  ];

  it.each(valid)('%s + %s -> %s', (from, event, to) => {
    expect(nextCommentStatus(from, event)).toBe(to);
  });

  it.each(invalid)('%s + %s throws WorkflowTransitionError', (from, event) => {
    expect(() => nextCommentStatus(from, event)).toThrow(WorkflowTransitionError);
  });

  it('covers every status x event combination', () => {
    expect(valid.length + invalid.length).toBe(COMMENT_STATUSES.length * 3);
  });
});

describe('initialCommentStatus', () => {
  it('approval comments start closed', () => {
    expect(initialCommentStatus('approval')).toBe('closed');
  });
  it.each(['remark', 'expert', 'change_request', 'idea'] as const)('%s starts open', (type) => {
    expect(initialCommentStatus(type)).toBe('open');
  });
});
