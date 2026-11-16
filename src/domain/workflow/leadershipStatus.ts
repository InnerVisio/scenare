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
  if (status === 'draft') return { group: 'admin', label: 'Admin píše', sub: 'Ještě neodesláno ke kontrole', tone: 'text2' };
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

export type LeadershipDotColor = 'yellow' | 'green' | 'red' | 'grey';

export interface LeadershipDot {
  color: LeadershipDotColor;
  label: string;
  sub?: string;
  /** Where the row links: the review screen (`/kontrola/[code]`) or the script detail. */
  target: 'review' | 'script';
  /** Sort order within a category: yellow, red, green, grey. */
  rank: number;
}

/** Plain traffic-light status for the leadership home; `null` for postponed / cancelled scripts (not counted). */
export function leadershipDot(
  video: { approvalStatus: ApprovalStatus },
  actorId: string,
  decisionsOnLatest: Decision[],
  otherLeaderName?: string | null,
): LeadershipDot | null {
  const st = leadershipStatus(video, actorId, decisionsOnLatest, otherLeaderName);
  if (st.group === 'muted') return null;
  if (st.group === 'me') return { color: 'yellow', label: 'Ke kontrole', target: 'review', rank: 0 };
  if (st.group === 'other') {
    return {
      color: 'green',
      label: 'Zkontrolováno',
      sub: otherLeaderName ? `čeká na ${accusative(otherLeaderName)}` : 'čeká na druhého',
      target: 'review',
      rank: 2,
    };
  }
  if (st.group === 'approved') return { color: 'green', label: 'Schváleno', target: 'script', rank: 2 };
  if (video.approvalStatus === 'returned') return { color: 'red', label: 'Zamítnuto – Admin opravuje', target: 'script', rank: 1 };
  return { color: 'grey', label: 'Admin ještě píše', target: 'script', rank: 3 };
}
