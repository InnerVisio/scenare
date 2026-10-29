import type { CheckResult } from '@/domain/checks/runChecks';
import { toAccusative } from '@/domain/format/names';
import type { ApprovalStatus } from '@/domain/workflow/approval';
import type { ReviewData } from '@/server/review';

export interface ProgressLine {
  text: string;
  done: number;
  total: number;
}

/** „Schváleno 1/2 · čeká na Radka“ for scripts in (or past) the leaders' decision; null for other states. */
export function progressLine(status: ApprovalStatus, approval: ReviewData['approval'], viewerName: string): ProgressLine | null {
  if (status === 'approved') {
    const text = approval.approvedNames.length >= 2 ? 'Schváleno oběma' : `Schváleno · ${approval.approvedNames.join(', ')}`.replace(/ · $/, '');
    return { text, done: approval.approvedNames.length, total: Math.max(approval.required, approval.approvedNames.length) };
  }
  if (status !== 'in_review' && status !== 'final_review') return null;

  const done = approval.approvedNames.length;
  const awaited = approval.waitingFor.map((name) => (name === viewerName ? 'tebe' : toAccusative(name)));
  const who = awaited.length <= 1 ? awaited.join('') : `${awaited.slice(0, -1).join(', ')} a ${awaited.at(-1)}`;
  const text =
    done === 0
      ? who
        ? `Čeká na ${who}`
        : 'Čeká na rozhodnutí'
      : `Schváleno ${done}/${approval.required}${who ? ` · čeká na ${who}` : ''}`;
  return { text, done, total: approval.required };
}

/** Labels of the rules that did not pass. */
export function failingChecks(checks: CheckResult[]): string[] {
  return checks.filter((c) => c.status === 'fail').map((c) => c.label);
}
