export type Role = 'admin' | 'marketer' | 'leadership' | 'production';

export type Action =
  | 'script.create'
  | 'script.edit'
  | 'script.submit'
  | 'script.unlock'
  | 'script.lifecycle'
  | 'comment.create'
  | 'comment.suggest'
  | 'suggestion.decide'
  | 'comment.address'
  | 'comment.close'
  | 'comment.reopen'
  | 'number.flag'
  | 'number.confirm'
  | 'approval.decide'
  | 'settings.manage'
  | 'production.update'
  | 'reference.add'
  | 'reference.remove'
  | 'series.manage'
  | 'series.close'
  | 'publication.manage';

const ALL_ACTIONS: readonly Action[] = [
  'script.create',
  'script.edit',
  'script.submit',
  'script.unlock',
  'script.lifecycle',
  'comment.create',
  'comment.suggest',
  'suggestion.decide',
  'comment.address',
  'comment.close',
  'comment.reopen',
  'number.flag',
  'number.confirm',
  'approval.decide',
  'settings.manage',
  'production.update',
  'reference.add',
  'reference.remove',
  'series.manage',
  'series.close',
  'publication.manage',
];

/** Admin never acts as an approver: those actions belong to leadership only. */
const ADMIN_DENIED: ReadonlySet<Action> = new Set<Action>([
  'approval.decide',
  'number.confirm',
  'comment.close',
  'comment.reopen',
]);

const LEADERSHIP: ReadonlySet<Action> = new Set<Action>([
  'comment.create',
  'comment.suggest',
  'number.flag',
  'number.confirm',
  'approval.decide',
  'comment.close',
  'comment.reopen',
  'script.lifecycle',
  'series.close',
]);

const MARKETER_ALWAYS: ReadonlySet<Action> = new Set<Action>([
  'script.create',
  'comment.create',
  'comment.suggest',
  'number.flag',
]);

/** Marketer may do these only on a script they own. */
const MARKETER_OWNER_ONLY: ReadonlySet<Action> = new Set<Action>([
  'script.edit',
  'script.submit',
  'script.unlock',
  'suggestion.decide',
  'comment.address',
]);

const PRODUCTION: ReadonlySet<Action> = new Set<Action>(['production.update']);

/**
 * Single source of truth for permissions. Enforced server-side;
 * hiding controls in the UI is cosmetic only.
 */
export function can(
  user: { id: string; role: Role },
  action: Action,
  ctx?: { ownerId?: string | null },
): boolean {
  // Everybody may attach a sample; only its author (`ctx.ownerId`) or an admin may take it away.
  if (action === 'reference.add') return true;
  if (action === 'reference.remove') return user.role === 'admin' || (!!ctx?.ownerId && ctx.ownerId === user.id);
  switch (user.role) {
    case 'admin':
      return ALL_ACTIONS.includes(action) && !ADMIN_DENIED.has(action);
    case 'leadership':
      return LEADERSHIP.has(action);
    case 'marketer':
      if (MARKETER_ALWAYS.has(action)) return true;
      if (MARKETER_OWNER_ONLY.has(action)) return ctx?.ownerId === user.id;
      return false;
    case 'production':
      return PRODUCTION.has(action);
    default:
      return false;
  }
}
