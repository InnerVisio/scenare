import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { Db } from '@/db/client';
import * as s from '@/db/schema';
import { runChecks, type CheckResult } from '@/domain/checks/runChecks';
import { daysUntil } from '@/domain/format/date';
import type { Role } from '@/domain/policy/can';
import { durationSec, speakers } from '@/domain/script/metrics';
import type { ScriptBody } from '@/domain/script/types';
import {
  APPROVAL_STATUSES,
  evaluateDecisions,
  isAwaitingDecision,
  type ApprovalPolicy,
  type ApprovalStatus,
  type DecisionEvaluation,
} from '@/domain/workflow/approval';
import { COMMENT_TYPE_LABELS, type CommentType } from '@/domain/workflow/comments';
import { describeActivity } from './activityText';
import type { Actor } from './actor';
import { buildCheckContext, loadRules } from './checkContext';
import { DomainError } from './errors';
import {
  approvalSetup,
  leadershipUsers,
  loadVideo,
  statusOf,
  type CommentRow,
  type VersionRow,
  type VideoRow,
} from './loaders';

// ---------------------------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------------------------

interface UserInfo {
  name: string;
  initials: string;
  role: Role;
}

async function loadUsers(db: Db): Promise<Map<string, UserInfo>> {
  const rows = await db.select().from(s.users);
  return new Map(rows.map((u) => [u.id, { name: u.name, initials: u.initials, role: u.role }]));
}

const nameMap = (users: Map<string, UserInfo>) => new Map([...users].map(([id, u]) => [id, u.name]));

/** Latest version (highest versionNo) of each given video. */
async function latestVersionsFor(db: Db, videoIds: string[]): Promise<Map<string, VersionRow>> {
  if (videoIds.length === 0) return new Map();
  const rows = await db
    .selectDistinctOn([s.scriptVersions.videoId])
    .from(s.scriptVersions)
    .where(inArray(s.scriptVersions.videoId, videoIds))
    .orderBy(s.scriptVersions.videoId, desc(s.scriptVersions.versionNo));
  return new Map(rows.map((v) => [v.videoId, v]));
}

/** Count of open ROOT comments per video. */
async function openCommentCounts(db: Db, videoIds: string[]): Promise<Map<string, number>> {
  if (videoIds.length === 0) return new Map();
  const rows = await db
    .select({ videoId: s.comments.videoId, n: sql<number>`count(*)::int` })
    .from(s.comments)
    .where(and(inArray(s.comments.videoId, videoIds), isNull(s.comments.parentId), eq(s.comments.status, 'open')))
    .groupBy(s.comments.videoId);
  return new Map(rows.map((r) => [r.videoId, r.n]));
}

/** Speakers that are leaders, keyed by the speaker name used in scripts (`profile.data.speaker`). */
async function profileSpeakers(db: Db): Promise<Set<string>> {
  const rows = await db.select().from(s.lookupItems).where(eq(s.lookupItems.kind, 'profile'));
  return new Set(rows.map((r) => r.data.speaker).filter((v): v is string => typeof v === 'string' && v !== ''));
}

function castInitials(body: ScriptBody | null, profiles: Set<string>, ownerName: string): string {
  const matched = body ? speakers(body).filter((name) => profiles.has(name)) : [];
  if (matched.length >= 2) return matched.map((name) => name.charAt(0).toLocaleUpperCase('cs')).join(' + ');
  if (matched.length === 1) return matched[0];
  return ownerName;
}

const fold = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('cs');

// ---------------------------------------------------------------------------------------------
// Video list
// ---------------------------------------------------------------------------------------------

export interface VideoListFilters {
  cycleId?: string;
  plannedMonth?: string;
  categoryKey?: string;
  approvalStatus?: string;
  productionStatus?: string;
  seriesId?: string;
  /** Free text matched against code and title, ignoring case and diacritics. */
  q?: string;
}

export interface VideoListItem {
  id: string;
  code: string;
  title: string;
  categoryKey: string | null;
  approvalStatus: ApprovalStatus;
  productionStatus: string;
  cycleId: string | null;
  plannedMonth: string | null;
  durationSec: number | null;
  openComments: number;
  latestVersionNo: number | null;
  castInitials: string;
}

export async function listVideos(db: Db, _actor: Actor, filters: VideoListFilters): Promise<VideoListItem[]> {
  const conditions = [
    filters.cycleId ? eq(s.videos.cycleId, filters.cycleId) : undefined,
    filters.plannedMonth ? eq(s.videos.plannedMonth, filters.plannedMonth) : undefined,
    filters.categoryKey ? eq(s.videos.categoryKey, filters.categoryKey) : undefined,
    filters.approvalStatus ? eq(s.videos.approvalStatus, filters.approvalStatus) : undefined,
    filters.productionStatus ? eq(s.videos.productionStatus, filters.productionStatus) : undefined,
    filters.seriesId ? eq(s.videos.seriesId, filters.seriesId) : undefined,
  ].filter((c) => c !== undefined);

  let rows = await db
    .select()
    .from(s.videos)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(s.videos.code));

  const query = filters.q ? fold(filters.q.trim()) : '';
  if (query) rows = rows.filter((v) => fold(`${v.code} ${v.title}`).includes(query));

  return toListItems(db, rows);
}

async function toListItems(db: Db, rows: VideoRow[]): Promise<VideoListItem[]> {
  const ids = rows.map((v) => v.id);
  const [latest, counts, profiles, users] = await Promise.all([
    latestVersionsFor(db, ids),
    openCommentCounts(db, ids),
    profileSpeakers(db),
    loadUsers(db),
  ]);
  return rows.map((video) => {
    const version = latest.get(video.id);
    const body = version?.body ?? video.draft ?? null;
    return {
      id: video.id,
      code: video.code,
      title: video.title,
      categoryKey: video.categoryKey,
      approvalStatus: statusOf(video),
      productionStatus: video.productionStatus,
      cycleId: video.cycleId,
      plannedMonth: video.plannedMonth,
      durationSec: body ? durationSec(body) : null,
      openComments: counts.get(video.id) ?? 0,
      latestVersionNo: version?.versionNo ?? null,
      castInitials: castInitials(body, profiles, video.ownerId ? (users.get(video.ownerId)?.name ?? '') : ''),
    };
  });
}

// ---------------------------------------------------------------------------------------------
// Video detail
// ---------------------------------------------------------------------------------------------

export interface ThreadReply extends CommentRow {
  authorName: string;
  authorInitials: string;
}

export interface Thread extends CommentRow {
  authorName: string;
  authorInitials: string;
  /** 1-based position among the video's root comments (oldest first). */
  index: number;
  isDetached: boolean;
  replies: ThreadReply[];
}

export interface DecisionView {
  id: string;
  userId: string;
  userName: string;
  decision: 'approve' | 'return';
  note: string;
  overrodeWarnings: boolean;
  createdAt: Date;
}

export interface NumberCheckView {
  id: string;
  fieldId: string;
  quotedText: string;
  status: 'pending' | 'confirmed';
  flaggedByName: string | null;
  confirmedByName: string | null;
  confirmedAt: Date | null;
  createdAt: Date;
}

export interface VideoDetail {
  video: VideoRow;
  ownerName: string;
  /** Latest version's body, or the working draft before the first submit. */
  currentBody: ScriptBody | null;
  draft: ScriptBody | null;
  versions: VersionRow[];
  latestVersion: VersionRow | null;
  /** Decisions on the latest version, chronological. */
  decisions: DecisionView[];
  approval: {
    policy: ApprovalPolicy;
    decisions: { userName: string; decision: 'approve' | 'return'; note: string; createdAt: Date }[];
    state: DecisionEvaluation['state'];
    waitingFor: string[];
  };
  threads: Thread[];
  numberChecks: NumberCheckView[];
  checks: CheckResult[];
  activity: { text: string; createdAt: Date; actorName: string }[];
  /** Version number the actor last looked at, or null if never. */
  lastSeenVersionNo: number | null;
}

const ACTIVITY_LIMIT = 100;

export async function getVideoDetail(db: Db, actor: Actor, videoId: string): Promise<VideoDetail> {
  const video = await loadVideo(db, videoId);
  const users = await loadUsers(db);
  const names = nameMap(users);

  const versions = await db
    .select()
    .from(s.scriptVersions)
    .where(eq(s.scriptVersions.videoId, videoId))
    .orderBy(asc(s.scriptVersions.versionNo));
  const latest = versions.at(-1) ?? null;
  const currentBody = latest?.body ?? video.draft ?? null;

  const decisionRows = latest
    ? await db
        .select()
        .from(s.approvalDecisions)
        .where(eq(s.approvalDecisions.versionId, latest.id))
        .orderBy(asc(s.approvalDecisions.createdAt))
    : [];
  const decisions: DecisionView[] = decisionRows.map((d) => ({
    id: d.id,
    userId: d.userId,
    userName: names.get(d.userId) ?? '',
    decision: d.decision,
    note: d.note,
    overrodeWarnings: d.overrodeWarnings,
    createdAt: d.createdAt,
  }));

  const leadership = await leadershipUsers(db);
  const { policy, guarantorId } = await approvalSetup(db, video);
  const evaluation = latest
    ? evaluateDecisions({
        policy,
        leadershipUserIds: leadership.map((u) => u.id),
        seriesGuarantorId: guarantorId,
        decisions: decisionRows.map((d) => ({ userId: d.userId, decision: d.decision })),
      })
    : { state: 'pending' as const, approvedBy: [], waitingFor: [] };

  const commentRows = await db
    .select()
    .from(s.comments)
    .where(eq(s.comments.videoId, videoId))
    .orderBy(asc(s.comments.createdAt), asc(s.comments.id));
  const author = (id: string) => ({
    authorName: users.get(id)?.name ?? '',
    authorInitials: users.get(id)?.initials ?? '',
  });
  const repliesOf = new Map<string, ThreadReply[]>();
  for (const c of commentRows) {
    if (!c.parentId) continue;
    const list = repliesOf.get(c.parentId) ?? [];
    list.push({ ...c, ...author(c.authorId) });
    repliesOf.set(c.parentId, list);
  }
  const threads: Thread[] = commentRows
    .filter((c) => !c.parentId)
    .map((c, i) => ({
      ...c,
      ...author(c.authorId),
      index: i + 1,
      isDetached: c.anchor?.state === 'detached',
      replies: repliesOf.get(c.id) ?? [],
    }));

  const numberRows = await db
    .select()
    .from(s.numberChecks)
    .where(eq(s.numberChecks.videoId, videoId))
    .orderBy(asc(s.numberChecks.createdAt), asc(s.numberChecks.id));

  const checks = currentBody
    ? runChecks(await buildCheckContext(db, video, latest ?? { id: 'draft', body: currentBody }), await loadRules(db))
    : [];

  const activityRows = await db
    .select()
    .from(s.activityLog)
    .where(eq(s.activityLog.videoId, videoId))
    .orderBy(desc(s.activityLog.createdAt), desc(s.activityLog.id))
    .limit(ACTIVITY_LIMIT);

  const [seen] = await db
    .select({ versionNo: s.scriptVersions.versionNo })
    .from(s.viewMarks)
    .innerJoin(s.scriptVersions, eq(s.scriptVersions.id, s.viewMarks.lastSeenVersionId))
    .where(and(eq(s.viewMarks.userId, actor.id), eq(s.viewMarks.videoId, videoId)));

  return {
    video,
    ownerName: video.ownerId ? (names.get(video.ownerId) ?? '') : '',
    currentBody,
    draft: video.draft ?? null,
    versions,
    latestVersion: latest,
    decisions,
    approval: {
      policy,
      decisions: decisions.map(({ userName, decision, note, createdAt }) => ({ userName, decision, note, createdAt })),
      state: evaluation.state,
      waitingFor: evaluation.waitingFor.map((id) => names.get(id) ?? id),
    },
    threads,
    numberChecks: numberRows.map((n) => ({
      id: n.id,
      fieldId: n.fieldId,
      quotedText: n.quotedText,
      status: n.status,
      flaggedByName: n.flaggedBy ? (names.get(n.flaggedBy) ?? null) : null,
      confirmedByName: n.confirmedBy ? (names.get(n.confirmedBy) ?? null) : null,
      confirmedAt: n.confirmedAt,
      createdAt: n.createdAt,
    })),
    checks,
    activity: activityRows.map((row) => ({
      text: describeActivity({ ...row, videoCode: video.code }, names, actor).text,
      createdAt: row.createdAt,
      actorName: row.actorId ? (names.get(row.actorId) ?? '') : '',
    })),
    lastSeenVersionNo: seen?.versionNo ?? null,
  };
}

/** Remembers which version of a script the actor has looked at. */
export async function markSeen(
  db: Db,
  actor: Actor,
  input: { videoId: string; versionId: string },
  now: Date,
): Promise<void> {
  const [version] = await db
    .select({ id: s.scriptVersions.id })
    .from(s.scriptVersions)
    .where(and(eq(s.scriptVersions.id, input.versionId), eq(s.scriptVersions.videoId, input.videoId)));
  if (!version) throw new DomainError('NOT_FOUND', 'Verze nenalezena.');
  await db
    .insert(s.viewMarks)
    .values({ userId: actor.id, videoId: input.videoId, lastSeenVersionId: version.id, seenAt: now })
    .onConflictDoUpdate({
      target: [s.viewMarks.userId, s.viewMarks.videoId],
      set: { lastSeenVersionId: version.id, seenAt: now },
    });
}

// ---------------------------------------------------------------------------------------------
// Review queue
// ---------------------------------------------------------------------------------------------

export interface ReviewQueueItem {
  videoId: string;
  code: string;
  title: string;
  categoryKey: string | null;
  versionNo: number;
  isFinal: boolean;
  openComments: number;
  decidedByActor: boolean;
}

export async function getReviewQueue(db: Db, actor: Actor, filters: { cycleId?: string }): Promise<ReviewQueueItem[]> {
  const awaiting = await db
    .select()
    .from(s.videos)
    .where(
      and(
        inArray(s.videos.approvalStatus, APPROVAL_STATUSES.filter(isAwaitingDecision)),
        filters.cycleId ? eq(s.videos.cycleId, filters.cycleId) : undefined,
      ),
    );
  const ids = awaiting.map((v) => v.id);
  const [latest, counts] = await Promise.all([latestVersionsFor(db, ids), openCommentCounts(db, ids)]);

  const versionIds = [...latest.values()].map((v) => v.id);
  const mine =
    versionIds.length === 0
      ? []
      : await db
          .select()
          .from(s.approvalDecisions)
          .where(and(inArray(s.approvalDecisions.versionId, versionIds), eq(s.approvalDecisions.userId, actor.id)))
          .orderBy(asc(s.approvalDecisions.createdAt));
  // Latest decision per version wins.
  const lastDecision = new Map(mine.map((d) => [d.versionId, d.decision]));

  const items: ReviewQueueItem[] = [];
  for (const video of awaiting) {
    const version = latest.get(video.id);
    if (!version) continue;
    items.push({
      videoId: video.id,
      code: video.code,
      title: video.title,
      categoryKey: video.categoryKey,
      versionNo: version.versionNo,
      isFinal: video.approvalStatus === 'final_review',
      openComments: counts.get(video.id) ?? 0,
      decidedByActor: lastDecision.get(version.id) === 'approve',
    });
  }
  return items.sort((a, b) => Number(a.decidedByActor) - Number(b.decidedByActor) || a.code.localeCompare(b.code));
}

// ---------------------------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------------------------

export interface DashboardCycle {
  id: string;
  shootDate: string | null;
  approvalDeadline: string | null;
  daysToShoot: number | null;
  daysToDeadline: number | null;
  clipTarget: string;
  locations: string[];
  approvedCount: number;
}

export interface Dashboard {
  awaitingMe: number;
  cycle: DashboardCycle | null;
  openComments: { videoCode: string; author: string; typeLabel: string; body: string }[];
  openCommentsTotal: number;
  kanban: Record<ApprovalStatus, VideoListItem[]>;
  returnedToMe: number;
}

const pragueDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague', year: 'numeric', month: '2-digit', day: '2-digit' });
/** Midday UTC of a `YYYY-MM-DD` date: the same calendar day in Prague. */
const dayAtNoon = (iso: string) => new Date(`${iso}T12:00:00Z`);

function minusDays(iso: string, days: number): string {
  const d = dayAtNoon(iso);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

const LATEST_OPEN_COMMENTS = 2;

export async function getDashboard(db: Db, actor: Actor, now: Date): Promise<Dashboard> {
  const [settings] = await db.select().from(s.settings).where(eq(s.settings.id, 'global'));
  const approvalDaysBefore = settings?.approvalDaysBefore ?? 7;

  const today = pragueDay.format(now);
  const cycles = await db.select().from(s.shootingCycles).orderBy(asc(s.shootingCycles.shootDate), asc(s.shootingCycles.id));
  const upcoming = cycles.find((c) => c.shootDate !== null && c.shootDate >= today);
  const cycleRow = upcoming ?? [...cycles].sort((a, b) => b.id.localeCompare(a.id))[0];

  let cycle: DashboardCycle | null = null;
  const kanban = Object.fromEntries(APPROVAL_STATUSES.map((status) => [status, [] as VideoListItem[]])) as Record<
    ApprovalStatus,
    VideoListItem[]
  >;
  if (cycleRow) {
    const items = await listVideos(db, actor, { cycleId: cycleRow.id });
    for (const item of items) kanban[item.approvalStatus].push(item);

    const approved = await db
      .select({ locationKeys: s.videos.locationKeys })
      .from(s.videos)
      .where(and(eq(s.videos.cycleId, cycleRow.id), eq(s.videos.approvalStatus, 'approved')));
    const keys = [...new Set(approved.flatMap((v) => v.locationKeys))];
    const labels = keys.length
      ? await db.select().from(s.lookupItems).where(and(eq(s.lookupItems.kind, 'location'), inArray(s.lookupItems.key, keys)))
      : [];
    const labelOf = new Map(labels.map((l) => [l.key, l.label]));

    const deadline = cycleRow.shootDate ? minusDays(cycleRow.shootDate, approvalDaysBefore) : null;
    cycle = {
      id: cycleRow.id,
      shootDate: cycleRow.shootDate,
      approvalDeadline: deadline,
      daysToShoot: cycleRow.shootDate ? daysUntil(dayAtNoon(cycleRow.shootDate), now) : null,
      daysToDeadline: deadline ? daysUntil(dayAtNoon(deadline), now) : null,
      clipTarget: cycleRow.clipTarget,
      locations: keys.map((key) => labelOf.get(key) ?? key),
      approvedCount: approved.length,
    };
  }

  const awaitingMe =
    actor.role === 'leadership' ? (await getReviewQueue(db, actor, {})).filter((i) => !i.decidedByActor).length : 0;

  const [{ returnedToMe }] = await db
    .select({ returnedToMe: sql<number>`count(*)::int` })
    .from(s.videos)
    .where(and(eq(s.videos.approvalStatus, 'returned'), eq(s.videos.ownerId, actor.id)));

  const openRoots = and(isNull(s.comments.parentId), eq(s.comments.status, 'open'));
  const [{ openCommentsTotal }] = await db
    .select({ openCommentsTotal: sql<number>`count(*)::int` })
    .from(s.comments)
    .where(openRoots);
  const latestComments = await db
    .select({
      videoCode: s.videos.code,
      author: s.users.name,
      type: s.comments.type,
      body: s.comments.body,
    })
    .from(s.comments)
    .innerJoin(s.videos, eq(s.videos.id, s.comments.videoId))
    .innerJoin(s.users, eq(s.users.id, s.comments.authorId))
    .where(openRoots)
    .orderBy(desc(s.comments.createdAt), desc(s.comments.id))
    .limit(LATEST_OPEN_COMMENTS);

  return {
    awaitingMe,
    cycle,
    openComments: latestComments.map((c) => ({
      videoCode: c.videoCode,
      author: c.author,
      typeLabel: COMMENT_TYPE_LABELS[c.type as CommentType] ?? c.type,
      body: c.body,
    })),
    openCommentsTotal,
    kanban,
    returnedToMe,
  };
}

// ---------------------------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------------------------

export interface NotificationItem {
  id: string;
  text: string;
  href: string;
  readAt: Date | null;
  createdAt: Date;
}

export async function listNotifications(db: Db, actor: Actor, opts: { limit: number }): Promise<NotificationItem[]> {
  const rows = await db
    .select({
      id: s.notifications.id,
      readAt: s.notifications.readAt,
      createdAt: s.notifications.createdAt,
      action: s.activityLog.action,
      actorId: s.activityLog.actorId,
      entityId: s.activityLog.entityId,
      after: s.activityLog.after,
      videoCode: s.videos.code,
    })
    .from(s.notifications)
    .innerJoin(s.activityLog, eq(s.activityLog.id, s.notifications.activityId))
    .leftJoin(s.videos, eq(s.videos.id, s.activityLog.videoId))
    .where(eq(s.notifications.userId, actor.id))
    .orderBy(desc(s.notifications.createdAt), desc(s.notifications.id))
    .limit(opts.limit);

  const names = nameMap(await loadUsers(db));
  return rows.map((row) => ({
    id: row.id,
    ...describeActivity(row, names, actor),
    readAt: row.readAt,
    createdAt: row.createdAt,
  }));
}

export async function unreadCount(db: Db, actor: Actor): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.notifications)
    .where(and(eq(s.notifications.userId, actor.id), isNull(s.notifications.readAt)));
  return n;
}

/** Marks one of the actor's own notifications as read (someone else's id is ignored). */
export async function markNotificationRead(db: Db, actor: Actor, id: string, now: Date): Promise<void> {
  await db
    .update(s.notifications)
    .set({ readAt: now })
    .where(and(eq(s.notifications.id, id), eq(s.notifications.userId, actor.id), isNull(s.notifications.readAt)));
}
