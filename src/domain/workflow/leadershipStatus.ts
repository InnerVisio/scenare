import { isAwaitingDecision, type ApprovalStatus, type Decision } from './approval';

export type LeadershipGroup = 'me' | 'other' | 'approved' | 'admin' | 'muted';
export type LeadershipTone = 'apricot' | 'lavender' | 'lime' | 'text2' | 'muted';

export interface LeadershipStatus {
  group: LeadershipGroup;
  label: string;
  /** Extra line under the label, e.g. „upraveno podle připomínek“. */
  sub?: string;
  tone: LeadershipTone;
}

/** „Radek“ → „Radka“, „Honza“ → „Honzu“ (accusative, for „Čeká na …“). */
export function accusative(name: string): string {
  if (/ek$/i.test(name)) return `${name.slice(0, -2)}ka`;
  if (/a$/i.test(name)) return `${name.slice(0, -1)}u`;
  return name;
}

/**
 * Plain-language status for leadership. `decisionsOnLatest` are the decisions on the latest version, oldest first;
 * `otherLeaderName` names the leader who has not approved yet (when there is exactly one).
 */
export function leadershipStatus(
  video: { approvalStatus: ApprovalStatus },
  actorId: string,
  decisionsOnLatest: Decision[],
  otherLeaderName?: string | null,
): LeadershipStatus {
  const status = video.approvalStatus;
  if (status === 'approved') return { group: 'approved', label: 'Schváleno – točíme', tone: 'lime' };
  if (status === 'returned') return { group: 'admin', label: 'Admin upravuje', tone: 'text2' };
  if (status === 'draft') return { group: 'admin', label: 'Admin píše', tone: 'text2' };
  if (status === 'postponed') return { group: 'muted', label: 'Odloženo', tone: 'muted' };
  if (status === 'cancelled') return { group: 'muted', label: 'Zrušeno', tone: 'muted' };
  if (!isAwaitingDecision(status)) return { group: 'admin', label: 'Admin píše', tone: 'text2' };

  const sub = status === 'final_review' ? 'upraveno podle připomínek' : undefined;
  const mine = [...decisionsOnLatest].reverse().find((d) => d.userId === actorId);
  if (mine?.decision === 'approve') {
    return { group: 'other', label: otherLeaderName ? `Čeká na ${accusative(otherLeaderName)}` : 'Čeká na druhého', sub, tone: 'lavender' };
  }
  return { group: 'me', label: 'Čeká na tebe', sub, tone: 'apricot' };
}
