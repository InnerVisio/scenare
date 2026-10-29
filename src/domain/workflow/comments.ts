import { WorkflowTransitionError } from './errors';

export const COMMENT_STATUSES = ['open', 'addressed', 'closed'] as const;
export type CommentStatus = (typeof COMMENT_STATUSES)[number];

export const COMMENT_STATUS_LABELS: Record<CommentStatus, string> = {
  open: 'Nevyřešeno',
  addressed: 'Zapracováno',
  closed: 'Uzavřeno',
};

export const COMMENT_TYPES = ['remark', 'expert', 'change_request', 'idea', 'approval'] as const;
export type CommentType = (typeof COMMENT_TYPES)[number];

export const COMMENT_TYPE_LABELS: Record<CommentType, string> = {
  remark: 'Připomínka',
  expert: 'Odborné doplnění',
  change_request: 'Požadavek na úpravu',
  idea: 'Nápad',
  approval: 'Souhlas / schválení',
};

export type CommentEvent = 'address' | 'close' | 'reopen';

const TRANSITIONS: Record<CommentEvent, Partial<Record<CommentStatus, CommentStatus>>> = {
  address: { open: 'addressed' },
  close: { open: 'closed', addressed: 'closed' },
  reopen: { addressed: 'open', closed: 'open' },
};

export function nextCommentStatus(current: CommentStatus, event: CommentEvent): CommentStatus {
  const next = TRANSITIONS[event][current];
  if (!next) throw new WorkflowTransitionError();
  return next;
}

export function initialCommentStatus(type: CommentType): CommentStatus {
  return type === 'approval' ? 'closed' : 'open';
}
