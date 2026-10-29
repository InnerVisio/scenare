export const APPROVAL_STATUSES = [
  'draft',
  'in_review',
  'returned',
  'final_review',
  'approved',
  'postponed',
  'cancelled',
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  draft: 'Rozpracováno',
  in_review: 'K připomínkám',
  returned: 'K dopracování',
  final_review: 'K finálnímu schválení',
  approved: 'Schváleno',
  postponed: 'Odloženo',
  cancelled: 'Zrušeno',
};

export type ApprovalPolicy = 'all_leadership' | 'any_leadership' | 'series_guarantor';

export function canSubmit(s: { status: ApprovalStatus; editingAfterApproval: boolean }): boolean {
  return (
    s.status === 'draft' ||
    s.status === 'returned' ||
    (s.status === 'approved' && s.editingAfterApproval)
  );
}

export function statusAfterSubmit(hasPreviousVersion: boolean): 'in_review' | 'final_review' {
  return hasPreviousVersion ? 'final_review' : 'in_review';
}

export function isAwaitingDecision(status: ApprovalStatus): boolean {
  return status === 'in_review' || status === 'final_review';
}

export interface Decision {
  userId: string;
  decision: 'approve' | 'return';
}

export interface DecisionEvaluation {
  state: 'approved' | 'returned' | 'pending';
  approvedBy: string[];
  waitingFor: string[];
}

/**
 * Evaluates leadership decisions. `decisions` must be in chronological order;
 * the latest decision per user wins and only leadership users count.
 */
export function evaluateDecisions(i: {
  policy: ApprovalPolicy;
  leadershipUserIds: string[];
  seriesGuarantorId: string | null;
  decisions: Decision[];
}): DecisionEvaluation {
  const latest = new Map<string, Decision['decision']>();
  for (const d of i.decisions) latest.set(d.userId, d.decision);

  const approvedBy = i.leadershipUserIds.filter((id) => latest.get(id) === 'approve');
  const anyReturned = i.leadershipUserIds.some((id) => latest.get(id) === 'return');

  if (anyReturned) return { state: 'returned', approvedBy, waitingFor: [] };

  const guarantorId = i.policy === 'series_guarantor' ? i.seriesGuarantorId : null;
  const required =
    guarantorId !== null
      ? [guarantorId]
      : i.policy === 'all_leadership'
        ? i.leadershipUserIds
        : null; // any_leadership (or series_guarantor without a guarantor): one approval suffices

  const approved =
    approvedBy.length > 0 && (required ? required.every((id) => approvedBy.includes(id)) : true);

  if (approved) return { state: 'approved', approvedBy, waitingFor: [] };

  const waitingFor = (required ?? i.leadershipUserIds).filter((id) => !approvedBy.includes(id));
  return { state: 'pending', approvedBy, waitingFor };
}
