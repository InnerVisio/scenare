import type { CheckResult } from '@/domain/checks/runChecks';
import { joinAccusative, toAccusative } from '@/domain/format/names';
import type { DecideResult } from '@/server/approvals';
import type { QueueItemVM, ReviewData, ThreadVM } from '@/server/review';

/** Czech noun forms: 1 → one, 2–4 → few, otherwise many. */
export function plural(n: number, one: string, few: string, many: string): string {
  return n === 1 ? one : n >= 2 && n <= 4 ? few : many;
}

export function unresolvedCount(threads: ThreadVM[]): number {
  return threads.filter((t) => t.status === 'open').length;
}

/** „1 nevyřešený“, „2 nevyřešené“, „5 nevyřešených“. */
export function unresolvedLabel(n: number): string {
  return `${n} ${plural(n, 'nevyřešený', 'nevyřešené', 'nevyřešených')}`;
}

const STATUS_ORDER = { open: 0, addressed: 1, closed: 2 } as const;

/** Open threads first, then addressed, then closed; by number inside a group. Detached ones go apart. */
export function groupThreads(threads: ThreadVM[]): { attached: ThreadVM[]; detached: ThreadVM[] } {
  const sorted = [...threads].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.index - b.index);
  return { attached: sorted.filter((t) => !t.isDetached), detached: sorted.filter((t) => t.isDetached) };
}

/** „6/8“: how many rules passed (or were ticked off by hand) out of all enabled ones. */
export function checkSummary(checks: CheckResult[]): { passed: number; total: number } {
  return { passed: checks.filter((c) => c.status === 'pass' || c.status === 'manual_done').length, total: checks.length };
}

const joinForms = (forms: string[]) => (forms.length <= 1 ? forms.join('') : `${forms.slice(0, -1).join(', ')} a ${forms.at(-1)}`);

export interface ApprovalLine {
  /** Text above the buttons, or null when nobody has decided yet. */
  text: string | null;
  actorApproved: boolean;
}

/**
 * „Schváleno 1/2 · čeká na Radka“, or „Schválil jsi · čeká na Radka“ when the actor is the one who
 * approved. When the actor is the one awaited, it says „čeká na tebe“.
 */
export function approvalLine(approval: ReviewData['approval'], actorName = ''): ApprovalLine {
  const awaited = approval.waitingFor.map((name) => (name === actorName ? 'tebe' : toAccusative(name)));
  const waiting = awaited.length > 0 ? ` · čeká na ${joinForms(awaited)}` : '';
  if (approval.actorApproved) return { text: `Schválil jsi${waiting}`, actorApproved: true };
  if (approval.approvedNames.length === 0) return { text: null, actorApproved: false };
  return { text: `Schváleno ${approval.approvedNames.length}/${approval.required}${waiting}`, actorApproved: false };
}

/** Where to go after the actor decided: the next item they have not approved yet, else null. */
export function nextUndecidedCode(queue: Pick<QueueItemVM, 'code' | 'decidedByActor'>[], currentCode: string): string | null {
  const here = queue.findIndex((item) => item.code === currentCode);
  const open = queue.map((item, i) => ({ item, i })).filter(({ item }) => !item.decidedByActor && item.code !== currentCode);
  return (open.find(({ i }) => i > here) ?? open[0])?.item.code ?? null;
}

/** Toast shown after an approve / return, per the outcome the server reported. */
export function decisionToast(decision: 'approve' | 'return', result: DecideResult): string {
  if (decision === 'return' || result.state === 'returned') return 'Vráceno k dopracování';
  if (result.state === 'approved') return 'Schváleno oběma ✓';
  return result.waitingFor.length > 0 ? `Schváleno · čeká na ${joinAccusative(result.waitingFor)}` : 'Schváleno';
}

/** Default center tab: the changes since the version the actor last saw, if there are newer ones. */
export function defaultCenterView(
  lastSeenVersionNo: number | null,
  latestNo: number | null,
): { view: 'read' | 'diff'; base: number | null } {
  if (latestNo !== null && lastSeenVersionNo !== null && lastSeenVersionNo < latestNo) {
    return { view: 'diff', base: lastSeenVersionNo };
  }
  return { view: 'read', base: null };
}

const fold = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('cs');

/** The `@query` being typed right before the caret, or null. */
export function activeMention(text: string, caret: number): { query: string; start: number } | null {
  const before = text.slice(0, caret);
  const match = /(^|\s)@([^\s@]*)$/u.exec(before);
  return match ? { query: match[2], start: before.length - match[2].length - 1 } : null;
}

/** Users whose name starts with what was typed after „@“ (ignoring case and diacritics). */
export function matchMentionUsers<T extends { name: string }>(users: T[], query: string): T[] {
  const q = fold(query);
  return users.filter((u) => fold(u.name).startsWith(q));
}

/** Ids of the users still mentioned as `@Name` in `text`. */
export function mentionedIds(text: string, users: { id: string; name: string }[]): string[] {
  return users
    .filter((u) => {
      const at = `@${u.name}`;
      const i = text.indexOf(at);
      return i !== -1 && (i === 0 || /\s/.test(text[i - 1])) && !/\p{L}/u.test(text[i + at.length] ?? '');
    })
    .map((u) => u.id);
}
