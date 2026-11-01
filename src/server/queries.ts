import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  or,
  sql,
  type AnyColumn,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { CycleMix } from "@/domain/metrics/mix";
import { cycleMixFrom } from "./mix";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { runChecks, type CheckResult } from "@/domain/checks/runChecks";
import { daysUntil } from "@/domain/format/date";
import type { Role } from "@/domain/policy/can";
import { durationSec, speakers } from "@/domain/script/metrics";
import type { ScriptBody } from "@/domain/script/types";
import {
  APPROVAL_STATUSES,
  evaluateDecisions,
  isAwaitingDecision,
  type ApprovalPolicy,
  type ApprovalStatus,
  type DecisionEvaluation,
} from "@/domain/workflow/approval";
import {
  COMMENT_TYPE_LABELS,
  type CommentType,
} from "@/domain/workflow/comments";
import { describeActivity } from "./activityText";
import type { Actor } from "./actor";
import { checkContextFrom, rulesFrom } from "./checkContext";
import {
  allLookups,
  categoryOptions,
  type EditorOptions,
  type LookupRow,
} from "./editorOptions";
import { DomainError } from "./errors";
import {
  statusOf,
  type CommentRow,
  type VersionRow,
  type VideoRow,
} from "./loaders";

// ---------------------------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------------------------

interface UserInfo {
  name: string;
  initials: string;
  role: Role;
}

const nameMap = (users: Map<string, UserInfo>) =>
  new Map([...users].map(([id, u]) => [id, u.name]));

/** Speakers that are leaders, keyed by the speaker name used in scripts (`profile.data.speaker`). */
const speakersOf = (lookups: LookupRow[]): Set<string> =>
  new Set(
    lookups
      .filter((l) => l.kind === "profile")
      .map((r) => r.data.speaker)
      .filter((v): v is string => typeof v === "string" && v !== ""),
  );

/** Correlated subquery: open ROOT comments of the outer video. */
const openCommentsOfVideo = sql<number>`(select count(*)::int from comments oc where oc.video_id = ${s.videos.id} and oc.parent_id is null and oc.status = 'open')`;
/** Join condition: the version with the highest number of the outer video. */
const isLatestVersion = (versions: {
  videoId: AnyColumn;
  versionNo: AnyColumn;
}) =>
  and(
    eq(versions.videoId, s.videos.id),
    eq(
      versions.versionNo,
      sql`(select max(m.version_no) from script_versions m where m.video_id = ${s.videos.id})`,
    ),
  );

function castInitials(
  body: ScriptBody | null,
  profiles: Set<string>,
  ownerName: string,
): string {
  const matched = body
    ? speakers(body).filter((name) => profiles.has(name))
    : [];
  if (matched.length >= 2)
    return matched
      .map((name) => name.charAt(0).toLocaleUpperCase("cs"))
      .join(" + ");
  if (matched.length === 1) return matched[0];
  return ownerName;
}

const fold = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("cs");

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
  /** Only scripts missing a category or a treatment. */
  unassigned?: boolean;
}

export interface VideoListItem {
  id: string;
  code: string;
  title: string;
  categoryKey: string | null;
  treatmentKey: string | null;
  profileKey: string | null;
  characterKey: string | null;
  approvalStatus: ApprovalStatus;
  productionStatus: string;
  cycleId: string | null;
  plannedMonth: string | null;
  formatKey: string | null;
  isTrialReel: boolean;
  seriesId: string | null;
  episodeNo: number | null;
  /** `YYYY-MM-DD`; the script is overdue after this day unless it is already decided. */
  scriptDueDate: string | null;
  durationSec: number | null;
  openComments: number;
  latestVersionNo: number | null;
  castInitials: string;
  locationKeys: string[];
}

export async function listVideos(
  db: Db,
  _actor: Actor,
  filters: VideoListFilters,
  lookups?: LookupRow[],
): Promise<VideoListItem[]> {
  const conditions = [
    filters.cycleId ? eq(s.videos.cycleId, filters.cycleId) : undefined,
    filters.plannedMonth
      ? eq(s.videos.plannedMonth, filters.plannedMonth)
      : undefined,
    filters.categoryKey
      ? eq(s.videos.categoryKey, filters.categoryKey)
      : undefined,
    filters.approvalStatus
      ? eq(s.videos.approvalStatus, filters.approvalStatus)
      : undefined,
    filters.productionStatus
      ? eq(s.videos.productionStatus, filters.productionStatus)
      : undefined,
    filters.seriesId ? eq(s.videos.seriesId, filters.seriesId) : undefined,
    filters.unassigned
      ? or(isNull(s.videos.categoryKey), isNull(s.videos.treatmentKey))
      : undefined,
  ].filter((c) => c !== undefined);

  // Latest version, owner and open-comment count come with the videos: no query per video.
  const latest = alias(s.scriptVersions, "lv");
  const [rows, profileRows] = await Promise.all([
    db
      .select({
        video: s.videos,
        versionNo: latest.versionNo,
        versionBody: latest.body,
        ownerName: s.users.name,
        openComments: openCommentsOfVideo,
      })
      .from(s.videos)
      .leftJoin(latest, isLatestVersion(latest))
      .leftJoin(s.users, eq(s.users.id, s.videos.ownerId))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(s.videos.code)),
    lookups ??
      db.select().from(s.lookupItems).where(eq(s.lookupItems.kind, "profile")),
  ]);
  const profiles = speakersOf(profileRows);

  const query = filters.q ? fold(filters.q.trim()) : "";
  return rows
    .filter(
      ({ video }) =>
        !query || fold(`${video.code} ${video.title}`).includes(query),
    )
    .map(({ video, versionNo, versionBody, ownerName, openComments }) => {
      const body = versionBody ?? video.draft ?? null;
      return {
        id: video.id,
        code: video.code,
        title: video.title,
        categoryKey: video.categoryKey,
        treatmentKey: video.treatmentKey,
        profileKey: video.profileKey,
        characterKey: video.characterKey,
        approvalStatus: statusOf(video),
        productionStatus: video.productionStatus,
        cycleId: video.cycleId,
        plannedMonth: video.plannedMonth,
        formatKey: video.formatKey,
        isTrialReel: video.isTrialReel,
        seriesId: video.seriesId,
        episodeNo: video.episodeNo,
        scriptDueDate: video.scriptDueDate,
        durationSec: body ? durationSec(body) : null,
        openComments,
        latestVersionNo: versionNo ?? null,
        castInitials: castInitials(body, profiles, ownerName ?? ""),
        locationKeys: video.locationKeys,
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
  decision: "approve" | "return";
  note: string;
  overrodeWarnings: boolean;
  createdAt: Date;
}

export interface NumberCheckView {
  id: string;
  fieldId: string;
  quotedText: string;
  status: "pending" | "confirmed";
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
    decisions: {
      userName: string;
      decision: "approve" | "return";
      note: string;
      createdAt: Date;
    }[];
    state: DecisionEvaluation["state"];
    waitingFor: string[];
  };
  threads: Thread[];
  numberChecks: NumberCheckView[];
  checks: CheckResult[];
  activity: { text: string; createdAt: Date; actorName: string }[];
  /** Version number the actor last looked at, or null if never. */
  lastSeenVersionNo: number | null;
  /** Every decision on every version, oldest first. */
  allDecisions: DecisionRow[];
  /** Reference rows already loaded for the detail, reused by the page loaders instead of querying again. */
  refs: {
    users: (typeof s.users.$inferSelect)[];
    lookups: LookupRow[];
    series: SeriesRow | null;
    cycle: CycleRow | null;
    approvalDaysBefore: number;
  };
}

const ACTIVITY_LIMIT = 100;

type SeriesRow = typeof s.series.$inferSelect;
type CycleRow = typeof s.shootingCycles.$inferSelect;

/** The video with everything that hangs off it 1:1, in a single query. */
export interface VideoHead {
  video: VideoRow;
  series: SeriesRow | null;
  cycle: CycleRow | null;
  approvalPolicy: ApprovalPolicy;
  approvalDaysBefore: number;
  seenVersionNo: number | null;
  /** `cycleParam` when it names an existing cycle. */
  filterCycleId: string | null;
  /** Place among the cycle's non-cancelled scripts of the same category, by code; null without cycle or category. */
  categoryPosition: { position: number; total: number } | null;
}

export async function loadVideoHead(
  db: Db,
  actor: Actor,
  target: string | { code: string },
  cycleParam?: string,
): Promise<VideoHead> {
  const seen = alias(s.scriptVersions, "seen_version");
  const filterCycle = alias(s.shootingCycles, "filter_cycle");
  const [row] = await db
    .select({
      video: s.videos,
      series: s.series,
      cycle: s.shootingCycles,
      settings: s.settings,
      seenNo: seen.versionNo,
      filterCycleId: filterCycle.id,
      categoryPosition: sql<{ position: number; total: number } | null>`(
        select case when ${s.videos.cycleId} is null or ${s.videos.categoryKey} is null then null
          else json_build_object('position', count(*) filter (where peer.code <= ${s.videos.code}), 'total', count(*)) end
        from videos peer
        where peer.cycle_id = ${s.videos.cycleId} and peer.category_key = ${s.videos.categoryKey} and peer.approval_status <> 'cancelled')`,
    })
    .from(s.videos)
    .leftJoin(s.series, eq(s.series.id, s.videos.seriesId))
    .leftJoin(s.shootingCycles, eq(s.shootingCycles.id, s.videos.cycleId))
    .leftJoin(s.settings, eq(s.settings.id, "global"))
    .leftJoin(
      s.viewMarks,
      and(
        eq(s.viewMarks.videoId, s.videos.id),
        eq(s.viewMarks.userId, actor.id),
      ),
    )
    .leftJoin(seen, eq(seen.id, s.viewMarks.lastSeenVersionId))
    .leftJoin(filterCycle, eq(filterCycle.id, cycleParam ?? ""))
    .where(
      typeof target === "string"
        ? eq(s.videos.id, target)
        : eq(s.videos.code, target.code),
    );
  if (!row) throw new DomainError("NOT_FOUND", "Scénář nenalezen.");
  return {
    video: row.video,
    series: row.series,
    cycle: row.cycle,
    approvalPolicy: (row.settings?.approvalPolicy ??
      "all_leadership") as ApprovalPolicy,
    approvalDaysBefore: row.settings?.approvalDaysBefore ?? 7,
    seenVersionNo: row.seenNo ?? null,
    filterCycleId: row.filterCycleId ?? null,
    categoryPosition: row.categoryPosition ?? null,
  };
}

export interface DecisionRow {
  versionId: string;
  userId: string;
  userName: string;
  decision: "approve" | "return";
  note: string;
  createdAt: Date;
}

export async function getVideoDetail(
  db: Db,
  actor: Actor,
  videoId: string,
): Promise<VideoDetail> {
  return buildVideoDetail(db, actor, await loadVideoHead(db, actor, videoId));
}

/** Everything about one script in 6 parallel queries (5 without the activity feed), however many comments it has. */
export async function buildVideoDetail(
  db: Db,
  actor: Actor,
  head: VideoHead,
  opts: { activity?: boolean } = {},
): Promise<VideoDetail> {
  const { video } = head;
  const videoId = video.id;
  const [
    userRows,
    lookups,
    versionRows,
    commentRows,
    numberRows,
    activityRows,
  ] = await Promise.all([
    db.select().from(s.users).orderBy(asc(s.users.name)),
    allLookups(db),
    db
      .select({ version: s.scriptVersions, decision: s.approvalDecisions })
      .from(s.scriptVersions)
      .leftJoin(
        s.approvalDecisions,
        eq(s.approvalDecisions.versionId, s.scriptVersions.id),
      )
      .where(eq(s.scriptVersions.videoId, videoId))
      .orderBy(
        asc(s.scriptVersions.versionNo),
        asc(s.approvalDecisions.createdAt),
      ),
    db
      .select()
      .from(s.comments)
      .where(eq(s.comments.videoId, videoId))
      .orderBy(asc(s.comments.createdAt), asc(s.comments.id)),
    db
      .select()
      .from(s.numberChecks)
      .where(eq(s.numberChecks.videoId, videoId))
      .orderBy(asc(s.numberChecks.createdAt), asc(s.numberChecks.id)),
    opts.activity === false
      ? Promise.resolve([])
      : db
          .select()
          .from(s.activityLog)
          .where(eq(s.activityLog.videoId, videoId))
          .orderBy(desc(s.activityLog.createdAt), desc(s.activityLog.id))
          .limit(ACTIVITY_LIMIT),
  ]);
  const users = new Map(
    userRows.map((u) => [
      u.id,
      { name: u.name, initials: u.initials, role: u.role },
    ]),
  );
  const names = nameMap(users);

  const versions = [
    ...new Map(versionRows.map((r) => [r.version.id, r.version])).values(),
  ];
  const latest = versions.at(-1) ?? null;
  const currentBody = latest?.body ?? video.draft ?? null;

  const allDecisions: DecisionRow[] = versionRows.flatMap(({ decision: d }) =>
    d
      ? [
          {
            versionId: d.versionId,
            userId: d.userId,
            userName: names.get(d.userId) ?? "",
            decision: d.decision,
            note: d.note,
            createdAt: d.createdAt,
          },
        ]
      : [],
  );
  const decisionRows = latest
    ? versionRows.flatMap((r) =>
        r.decision && r.version.id === latest.id ? [r.decision] : [],
      )
    : [];
  const decisions: DecisionView[] = decisionRows.map((d) => ({
    id: d.id,
    userId: d.userId,
    userName: names.get(d.userId) ?? "",
    decision: d.decision,
    note: d.note,
    overrodeWarnings: d.overrodeWarnings,
    createdAt: d.createdAt,
  }));

  const leadership = userRows.filter((u) => u.role === "leadership");
  const guarantorId =
    head.series?.guarantorId &&
    users.get(head.series.guarantorId)?.role === "leadership"
      ? head.series.guarantorId
      : null;
  const evaluation = latest
    ? evaluateDecisions({
        policy: head.approvalPolicy,
        leadershipUserIds: leadership.map((u) => u.id),
        seriesGuarantorId: guarantorId,
        decisions: decisionRows.map((d) => ({
          userId: d.userId,
          decision: d.decision,
        })),
      })
    : { state: "pending" as const, approvedBy: [], waitingFor: [] };

  const author = (id: string) => ({
    authorName: users.get(id)?.name ?? "",
    authorInitials: users.get(id)?.initials ?? "",
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
      isDetached: c.anchor?.state === "detached",
      replies: repliesOf.get(c.id) ?? [],
    }));

  const checks = currentBody
    ? runChecks(
        checkContextFrom(
          video,
          latest ?? { id: "draft", body: currentBody },
          lookups,
          numberRows,
        ),
        rulesFrom(lookups),
      )
    : [];

  return {
    video,
    ownerName: video.ownerId ? (names.get(video.ownerId) ?? "") : "",
    currentBody,
    draft: video.draft ?? null,
    versions,
    latestVersion: latest,
    decisions,
    allDecisions,
    approval: {
      policy: head.approvalPolicy,
      decisions: decisions.map(({ userName, decision, note, createdAt }) => ({
        userName,
        decision,
        note,
        createdAt,
      })),
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
      confirmedByName: n.confirmedBy
        ? (names.get(n.confirmedBy) ?? null)
        : null,
      confirmedAt: n.confirmedAt,
      createdAt: n.createdAt,
    })),
    checks,
    activity: activityRows.map((row) => ({
      text: describeActivity({ ...row, videoCode: video.code }, names, actor)
        .text,
      createdAt: row.createdAt,
      actorName: row.actorId ? (names.get(row.actorId) ?? "") : "",
    })),
    lastSeenVersionNo: head.seenVersionNo,
    refs: {
      users: userRows,
      lookups,
      series: head.series,
      cycle: head.cycle,
      approvalDaysBefore: head.approvalDaysBefore,
    },
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
    .where(
      and(
        eq(s.scriptVersions.id, input.versionId),
        eq(s.scriptVersions.videoId, input.videoId),
      ),
    );
  if (!version) throw new DomainError("NOT_FOUND", "Verze nenalezena.");
  await db
    .insert(s.viewMarks)
    .values({
      userId: actor.id,
      videoId: input.videoId,
      lastSeenVersionId: version.id,
      seenAt: now,
    })
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

const AWAITING_SQL = sql.raw(
  APPROVAL_STATUSES.filter(isAwaitingDecision)
    .map((status) => `'${status}'`)
    .join(", "),
);

export async function getReviewQueue(
  db: Db,
  actor: Actor,
  filters: { cycleId?: string },
): Promise<ReviewQueueItem[]> {
  // One query: latest version, open-comment count and the actor's last decision are correlated subqueries.
  const rows = await db
    .select({
      videoId: s.videos.id,
      code: s.videos.code,
      title: s.videos.title,
      categoryKey: s.videos.categoryKey,
      status: s.videos.approvalStatus,
      versionNo: s.scriptVersions.versionNo,
      openComments: openCommentsOfVideo,
      lastDecision: sql<
        string | null
      >`(select d.decision from approval_decisions d where d.version_id = ${s.scriptVersions.id} and d.user_id = ${actor.id} order by d.created_at desc limit 1)`,
    })
    .from(s.videos)
    .innerJoin(s.scriptVersions, isLatestVersion(s.scriptVersions))
    .where(
      and(
        inArray(
          s.videos.approvalStatus,
          APPROVAL_STATUSES.filter(isAwaitingDecision),
        ),
        filters.cycleId ? eq(s.videos.cycleId, filters.cycleId) : undefined,
      ),
    );

  const items: ReviewQueueItem[] = rows.map((row) => ({
    videoId: row.videoId,
    code: row.code,
    title: row.title,
    categoryKey: row.categoryKey,
    versionNo: row.versionNo,
    isFinal: row.status === "final_review",
    openComments: row.openComments,
    decidedByActor: row.lastDecision === "approve",
  }));
  return items.sort(
    (a, b) =>
      Number(a.decidedByActor) - Number(b.decidedByActor) ||
      a.code.localeCompare(b.code),
  );
}

/** SQL scalar: awaiting scripts the actor has not approved yet (for the sidebar badge). */
export const queueCountSql = (actorId: string) => sql<number>`(
  select count(*)::int from videos qv
  join script_versions qlv on qlv.video_id = qv.id
    and qlv.version_no = (select max(m.version_no) from script_versions m where m.video_id = qv.id)
  where qv.approval_status in (${AWAITING_SQL})
    and coalesce((select d.decision from approval_decisions d where d.version_id = qlv.id and d.user_id = ${actorId} order by d.created_at desc limit 1), '') <> 'approve'
)`;

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
  openComments: {
    videoCode: string;
    author: string;
    typeLabel: string;
    body: string;
  }[];
  openCommentsTotal: number;
  kanban: Record<ApprovalStatus, VideoListItem[]>;
  returnedToMe: number;
  /** Category pickers, from the same lookups query as the cards. */
  categories: EditorOptions["categories"];
  /** Mix of the shown cycle, computed from the cycle's videos and lookups already loaded. */
  mix: CycleMix | null;
}

const pragueDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Prague",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
/** Midday UTC of a `YYYY-MM-DD` date: the same calendar day in Prague. */
const dayAtNoon = (iso: string) => new Date(`${iso}T12:00:00Z`);

function minusDays(iso: string, days: number): string {
  const d = dayAtNoon(iso);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

const LATEST_OPEN_COMMENTS = 2;

export async function getDashboard(
  db: Db,
  actor: Actor,
  now: Date,
): Promise<Dashboard> {
  const today = pragueDay.format(now);
  const openRoots = and(
    isNull(s.comments.parentId),
    eq(s.comments.status, "open"),
  );
  // Round 1: everything that does not depend on the chosen cycle, in parallel.
  const [cycleRows, lookups, queue, [totals], latestComments] =
    await Promise.all([
      db
        .select({
          cycle: s.shootingCycles,
          daysBefore: s.settings.approvalDaysBefore,
          tolerancePp: s.settings.tolerancePp,
        })
        .from(s.shootingCycles)
        .leftJoin(s.settings, eq(s.settings.id, "global"))
        .orderBy(asc(s.shootingCycles.shootDate), asc(s.shootingCycles.id)),
      allLookups(db),
      actor.role === "leadership"
        ? getReviewQueue(db, actor, {})
        : Promise.resolve([]),
      db
        .select({
          returnedToMe: sql<number>`(select count(*)::int from videos where approval_status = 'returned' and owner_id = ${actor.id})`,
          openCommentsTotal: sql<number>`(select count(*)::int from comments where parent_id is null and status = 'open')`,
        })
        .from(sql`(select 1) as one`),
      db
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
        .limit(LATEST_OPEN_COMMENTS),
    ]);
  const cycles = cycleRows.map((r) => r.cycle);
  const approvalDaysBefore = cycleRows[0]?.daysBefore ?? 7;
  const upcoming = cycles.find(
    (c) => c.shootDate !== null && c.shootDate >= today,
  );
  const cycleRow =
    upcoming ?? [...cycles].sort((a, b) => b.id.localeCompare(a.id))[0];

  let cycle: DashboardCycle | null = null;
  let mix: CycleMix | null = null;
  const kanban = Object.fromEntries(
    APPROVAL_STATUSES.map((status) => [status, [] as VideoListItem[]]),
  ) as Record<ApprovalStatus, VideoListItem[]>;
  if (cycleRow) {
    const items = await listVideos(
      db,
      actor,
      { cycleId: cycleRow.id },
      lookups,
    );
    for (const item of items) kanban[item.approvalStatus].push(item);
    mix = cycleMixFrom({
      videos: items,
      lookups,
      plan: cycleRow.plannedVideos,
      tolerancePp: cycleRows[0]?.tolerancePp ?? 10,
    });

    const approved = kanban.approved;
    const keys = [...new Set(approved.flatMap((v) => v.locationKeys))];
    const labelOf = new Map(
      lookups.filter((l) => l.kind === "location").map((l) => [l.key, l.label]),
    );

    const deadline = cycleRow.shootDate
      ? minusDays(cycleRow.shootDate, approvalDaysBefore)
      : null;
    cycle = {
      id: cycleRow.id,
      shootDate: cycleRow.shootDate,
      approvalDeadline: deadline,
      daysToShoot: cycleRow.shootDate
        ? daysUntil(dayAtNoon(cycleRow.shootDate), now)
        : null,
      daysToDeadline: deadline ? daysUntil(dayAtNoon(deadline), now) : null,
      clipTarget: cycleRow.clipTarget,
      locations: keys.map((key) => labelOf.get(key) ?? key),
      approvedCount: approved.length,
    };
  }

  return {
    awaitingMe: queue.filter((i) => !i.decidedByActor).length,
    cycle,
    openComments: latestComments.map((c) => ({
      videoCode: c.videoCode,
      author: c.author,
      typeLabel: COMMENT_TYPE_LABELS[c.type as CommentType] ?? c.type,
      body: c.body,
    })),
    openCommentsTotal: totals.openCommentsTotal,
    kanban,
    returnedToMe: totals.returnedToMe,
    categories: categoryOptions(lookups),
    mix,
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

/** Latest notifications plus the unread total, in one query (window count runs before LIMIT). */
export async function loadNotificationFeed(
  db: Db,
  actor: Actor,
  opts: { limit: number },
): Promise<{ items: NotificationItem[]; unread: number }> {
  const rows = await db
    .select({
      id: s.notifications.id,
      readAt: s.notifications.readAt,
      createdAt: s.notifications.createdAt,
      action: s.activityLog.action,
      actorId: s.activityLog.actorId,
      actorName: s.users.name,
      entityId: s.activityLog.entityId,
      after: s.activityLog.after,
      videoCode: s.videos.code,
      unread: sql<number>`(count(*) filter (where ${s.notifications.readAt} is null) over ())::int`,
    })
    .from(s.notifications)
    .innerJoin(s.activityLog, eq(s.activityLog.id, s.notifications.activityId))
    .leftJoin(s.videos, eq(s.videos.id, s.activityLog.videoId))
    .leftJoin(s.users, eq(s.users.id, s.activityLog.actorId))
    .where(eq(s.notifications.userId, actor.id))
    .orderBy(desc(s.notifications.createdAt), desc(s.notifications.id))
    .limit(opts.limit);

  const names = new Map(
    rows.flatMap((r) =>
      r.actorId && r.actorName ? [[r.actorId, r.actorName] as const] : [],
    ),
  );
  return {
    unread: rows[0]?.unread ?? 0,
    items: rows.map((row) => ({
      id: row.id,
      ...describeActivity(row, names, actor),
      readAt: row.readAt,
      createdAt: row.createdAt,
    })),
  };
}

export async function listNotifications(
  db: Db,
  actor: Actor,
  opts: { limit: number },
): Promise<NotificationItem[]> {
  return (await loadNotificationFeed(db, actor, opts)).items;
}

export async function unreadCount(db: Db, actor: Actor): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.notifications)
    .where(
      and(eq(s.notifications.userId, actor.id), isNull(s.notifications.readAt)),
    );
  return n;
}

/** Marks one of the actor's own notifications as read (someone else's id is ignored). */
export async function markNotificationRead(
  db: Db,
  actor: Actor,
  id: string,
  now: Date,
): Promise<void> {
  await db
    .update(s.notifications)
    .set({ readAt: now })
    .where(
      and(
        eq(s.notifications.id, id),
        eq(s.notifications.userId, actor.id),
        isNull(s.notifications.readAt),
      ),
    );
}
