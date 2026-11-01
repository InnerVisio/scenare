import type { Db } from '@/db/client';
import * as s from '@/db/schema';
import type { Anchor } from '@/domain/anchors/remap';
import type { CheckResult } from '@/domain/checks/runChecks';
import { daysUntil } from '@/domain/format/date';
import { can } from '@/domain/policy/can';
import type { ScriptBody } from '@/domain/script/types';
import { isAwaitingDecision, type ApprovalStatus } from '@/domain/workflow/approval';
import type { CommentStatus, CommentType } from '@/domain/workflow/comments';
import { parseCycleParam } from '@/ui/monthParams';
import type { ScriptMeta } from '@/app/(app)/_components/script-view/types';
import type { Actor } from './actor';
import { DomainError } from './errors';
import { statusOf } from './loaders';
import {
  buildVideoDetail,
  getReviewQueue,
  loadVideoHead,
  type DecisionRow,
  type NumberCheckView,
  type ReviewQueueItem,
  type VideoDetail,
} from './queries';
import { toReferenceVMs, type ReferenceVM } from './references';
import { buildScriptMeta } from './scriptMeta';

// View models for the review screen. Dates are ISO strings so everything crosses the server/client
// boundary unchanged and renders the same on both sides.

export interface ReplyVM {
  id: string;
  authorName: string;
  authorInitials: string;
  body: string;
  createdAt: string;
}

export interface ThreadVM {
  id: string;
  index: number;
  type: CommentType;
  status: CommentStatus;
  body: string;
  authorId: string;
  authorName: string;
  authorInitials: string;
  createdAt: string;
  versionNo: number | null;
  anchor: Anchor | null;
  isDetached: boolean;
  suggestion: { replacement: string; state: 'pending' | 'accepted' | 'rejected'; reason: string | null } | null;
  replies: ReplyVM[];
}

export interface VersionVM {
  id: string;
  no: number;
  createdAt: string;
  createdByName: string;
  origin: 'submit' | 'accepted_suggestions' | 'import';
  changeSummary: string;
  decisions: { userName: string; decision: 'approve' | 'return'; note: string; createdAt: string }[];
  commentCount: number;
}

export interface QueueItemVM extends ReviewQueueItem {
  category: { short: string; label: string; colors: { color: string; textColor: string } } | null;
}

export interface NumberCheckVM extends Omit<NumberCheckView, 'confirmedAt' | 'createdAt'> {
  confirmedAt: string | null;
  createdAt: string;
}

export interface ReviewPerms {
  /** Approve / return buttons: leadership on a script that awaits a decision. */
  decide: boolean;
  comment: boolean;
  suggest: boolean;
  flagNumber: boolean;
  confirmNumber: boolean;
  close: boolean;
  reopen: boolean;
  address: boolean;
  decideSuggestion: boolean;
  manualCheck: boolean;
}

export interface ReviewData {
  /** Server time; relative timestamps are rendered against it so SSR and hydration agree. */
  nowIso: string;
  actor: { id: string; name: string };
  video: { id: string; code: string; title: string; status: ApprovalStatus };
  /** Latest version, or null before the first submit. */
  latest: { id: string; no: number } | null;
  body: ScriptBody;
  /** Version number → body, for comparisons. */
  bodies: Record<number, ScriptBody>;
  meta: ScriptMeta;
  references: ReferenceVM[];
  hookTypeLabels: Record<string, string>;
  versions: VersionVM[];
  threads: ThreadVM[];
  numberChecks: NumberCheckVM[];
  checks: CheckResult[];
  approval: {
    state: 'approved' | 'returned' | 'pending';
    approvedNames: string[];
    waitingFor: string[];
    required: number;
    actorApproved: boolean;
  };
  hasOwnCommentOnLatest: boolean;
  perms: ReviewPerms;
  queue: QueueItemVM[];
  /** 1-based position in the queue, or null when this script is not in it. */
  position: number | null;
  prevCode: string | null;
  nextCode: string | null;
  cycle: { id: string; shootDate: string | null; deadline: string | null; daysToDeadline: number | null } | null;
  users: { id: string; name: string }[];
  /** Version the actor last looked at, captured before this visit is recorded. */
  lastSeenVersionNo: number | null;
}

export function toThreadVMs(detail: VideoDetail, versionNoById: Map<string, number>): ThreadVM[] {
  return detail.threads.map((t) => ({
    id: t.id,
    index: t.index,
    type: t.type as CommentType,
    status: t.status as CommentStatus,
    body: t.body,
    authorId: t.authorId,
    authorName: t.authorName,
    authorInitials: t.authorInitials,
    createdAt: t.createdAt.toISOString(),
    versionNo: t.versionId ? (versionNoById.get(t.versionId) ?? null) : null,
    anchor: t.anchor,
    isDetached: t.isDetached,
    suggestion: t.suggestion
      ? { replacement: t.suggestion.replacement, state: t.suggestion.state, reason: t.suggestion.reason ?? null }
      : null,
    replies: t.replies.map((r) => ({
      id: r.id,
      authorName: r.authorName,
      authorInitials: r.authorInitials,
      body: r.body,
      createdAt: r.createdAt.toISOString(),
    })),
  }));
}

export type { DecisionRow };

export function toVersionVMs(detail: VideoDetail, decisionRows: DecisionRow[], userName: Map<string, string>): VersionVM[] {
  return detail.versions.map((v) => ({
    id: v.id,
    no: v.versionNo,
    createdAt: v.createdAt.toISOString(),
    createdByName: userName.get(v.createdBy) ?? '',
    origin: v.origin,
    changeSummary: v.changeSummary,
    decisions: decisionRows
      .filter((d) => d.versionId === v.id)
      .map((d) => ({ userName: d.userName, decision: d.decision, note: d.note, createdAt: d.createdAt.toISOString() })),
    commentCount: detail.threads.filter((t) => t.versionId === v.id).length,
  }));
}

export function reviewPerms(actor: Actor, ownerId: string | null, status: ApprovalStatus): ReviewPerms {
  const owner = { ownerId };
  return {
    decide: can(actor, 'approval.decide') && isAwaitingDecision(status),
    comment: can(actor, 'comment.create'),
    suggest: can(actor, 'comment.suggest'),
    flagNumber: can(actor, 'number.flag'),
    confirmNumber: can(actor, 'number.confirm'),
    close: can(actor, 'comment.close'),
    reopen: can(actor, 'comment.reopen'),
    address: can(actor, 'comment.address', owner),
    decideSuggestion: can(actor, 'suggestion.decide', owner),
    manualCheck: can(actor, 'approval.decide') || can(actor, 'script.edit', owner),
  };
}

/** Approval progress as shown in headers: who approved, who is awaited, how many approvals are needed. */
export function approvalProgress(detail: VideoDetail, actorId: string): ReviewData['approval'] {
  const latestDecision = new Map<string, 'approve' | 'return'>();
  for (const d of detail.decisions) latestDecision.set(d.userId, d.decision);
  const approvedNames = [...new Set(detail.decisions.filter((d) => latestDecision.get(d.userId) === 'approve').map((d) => d.userName))];
  const { approval } = detail;
  return {
    state: approval.state,
    approvedNames,
    waitingFor: approval.waitingFor,
    required: approval.policy === 'all_leadership' ? approvedNames.length + approval.waitingFor.length : 1,
    actorApproved: latestDecision.get(actorId) === 'approve',
  };
}

const dayAtNoon = (iso: string) => new Date(`${iso}T12:00:00Z`);

function minusDays(iso: string, days: number): string {
  const d = dayAtNoon(iso);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function loadReview(
  db: Db,
  actor: Actor,
  code: string,
  filters: { cycleId?: string },
  now: Date,
): Promise<ReviewData> {
  return (await loadReviewPage(db, actor, code, { cycleId: filters.cycleId }, now)).data;
}

/**
 * The review screen in 7 queries: the script head (which also validates `?cyklus=`), then the script's
 * rows and the queue in parallel. Pass the raw `?cyklus=` as `cycleParam`.
 */
export async function loadReviewPage(
  db: Db,
  actor: Actor,
  code: string,
  filter: { cycleId?: string; cycleParam?: string },
  now: Date,
): Promise<{ data: ReviewData; cycleId: string | undefined }> {
  const head = await loadVideoHead(db, actor, { code }, filter.cycleParam);
  const cycleId = filter.cycleId ?? head.filterCycleId ?? undefined;
  const [detail, queue] = await Promise.all([
    buildVideoDetail(db, actor, head, { activity: false }),
    getReviewQueue(db, actor, { cycleId }),
  ]);
  const { video, latestVersion: latest } = detail;
  if (!detail.currentBody) throw new DomainError('NOT_FOUND', 'Scénář zatím nemá žádný obsah.');

  const { hookTypeLabels, ...meta } = buildScriptMeta(detail);
  const userRows = detail.refs.users.map((u) => ({ id: u.id, name: u.name }));
  const userName = new Map(userRows.map((u) => [u.id, u.name]));
  const versionNoById = new Map(detail.versions.map((v) => [v.id, v.versionNo]));

  const threads = toThreadVMs(detail, versionNoById);
  const versions = toVersionVMs(detail, detail.allDecisions, userName);

  const categories = new Map(detail.refs.lookups.filter((l) => l.kind === 'category').map((l) => [l.key, l]));
  const queueVM: QueueItemVM[] = queue.map((item) => {
    const category = item.categoryKey ? categories.get(item.categoryKey) : undefined;
    return {
      ...item,
      category: category
        ? {
            short: String(category.data.short ?? category.label),
            label: category.label,
            colors: { color: String(category.data.color ?? '#F4F3FA'), textColor: String(category.data.textColor ?? '#17151F') },
          }
        : null,
    };
  });
  const position = queue.findIndex((item) => item.code === code);

  const status = statusOf(video);

  let cycle: ReviewData['cycle'] = null;
  const row = detail.refs.cycle;
  if (row) {
    const deadline = row.shootDate ? minusDays(row.shootDate, detail.refs.approvalDaysBefore) : null;
    cycle = {
      id: row.id,
      shootDate: row.shootDate,
      deadline,
      daysToDeadline: deadline ? daysUntil(dayAtNoon(deadline), now) : null,
    };
  }

  const data: ReviewData = {
    nowIso: now.toISOString(),
    actor: { id: actor.id, name: actor.name },
    video: { id: video.id, code: video.code, title: video.title, status },
    latest: latest ? { id: latest.id, no: latest.versionNo } : null,
    body: detail.currentBody,
    bodies: Object.fromEntries(detail.versions.map((v) => [v.versionNo, v.body])),
    meta,
    references: toReferenceVMs(video.references, actor, userName),
    hookTypeLabels,
    versions,
    threads,
    numberChecks: detail.numberChecks.map((n) => ({
      ...n,
      confirmedAt: n.confirmedAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
    checks: detail.checks,
    approval: approvalProgress(detail, actor.id),
    hasOwnCommentOnLatest: !!latest && detail.threads.some((t) => t.authorId === actor.id && t.versionId === latest.id),
    perms: reviewPerms(actor, video.ownerId, status),
    queue: queueVM,
    position: position >= 0 ? position + 1 : null,
    prevCode: position > 0 ? queue[position - 1].code : null,
    nextCode: position >= 0 && position < queue.length - 1 ? queue[position + 1].code : null,
    cycle,
    users: userRows.filter((u) => u.id !== actor.id),
    lastSeenVersionNo: detail.lastSeenVersionNo,
  };
  return { data, cycleId };
}

/** `?cyklus=` if it names an existing cycle, otherwise no filter. */
export async function resolveCycleFilter(db: Db, raw: string | string[] | undefined): Promise<string | undefined> {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const ids = (await db.select({ id: s.shootingCycles.id }).from(s.shootingCycles)).map((c) => c.id);
  return parseCycleParam(value, ids, null) ?? undefined;
}
