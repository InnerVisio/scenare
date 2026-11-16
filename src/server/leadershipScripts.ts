import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import * as s from "@/db/schema";
import { monthLabel } from "@/ui/monthParams";
import { cycleLabel, daysUntil } from "@/domain/format/date";
import {
  APPROVAL_STATUSES,
  isAwaitingDecision,
} from "@/domain/workflow/approval";
import {
  leadershipDot,
  leadershipStatus,
  type LeadershipDot,
  type LeadershipGroup,
  type LeadershipStatus,
} from "@/domain/workflow/leadershipStatus";
import type { Actor } from "./actor";
import {
  allLookups,
  categoryOptions,
  type EditorOptions,
} from "./editorOptions";
import { listVideos } from "./queries";

export interface LeadershipScriptItem {
  id: string;
  code: string;
  title: string;
  categoryKey: string | null;
  cast: string;
  cycleId: string | null;
  /** `YYYY-MM`: month of the shooting day, else the planned month; null when neither is set. */
  month: string | null;
  status: LeadershipStatus;
  /** Traffic-light status for the home; null for postponed / cancelled. */
  dot: LeadershipDot | null;
}

export type LeadershipGroups = Record<LeadershipGroup, LeadershipScriptItem[]>;

export interface LeadershipSection {
  id: string;
  label: string;
  shootDate: string | null;
  daysToShoot: number | null;
  approvalDeadline: string | null;
  daysToDeadline: number | null;
  approvedCount: number;
  /** Waiting for a leader's decision (groups `me` + `other`). */
  awaitingCount: number;
  totalCount: number;
  kind: "next" | "later" | "past";
  groups: LeadershipGroups;
}

export interface LeadershipScripts {
  all: boolean;
  sections: LeadershipSection[];
  /** Scripts without a cycle (`all` mode only). */
  unscheduled: LeadershipGroups;
  unscheduledCount: number;
  categories: EditorOptions["categories"];
}

const emptyGroups = (): LeadershipGroups => ({
  me: [],
  other: [],
  approved: [],
  admin: [],
  muted: [],
});
const AWAITING = APPROVAL_STATUSES.filter(isAwaitingDecision);

function minusDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Leadership's overview of scripts by shooting day: 5 queries (cycles, scripts + profiles, lookups, decisions, leaders). */
export async function getLeadershipScripts(
  db: Db,
  actor: Actor,
  opts: { all: boolean },
  now: Date,
): Promise<LeadershipScripts> {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
  }).format(now);
  const [cycleRows, lookups, videos, decisions, leaders] = await Promise.all([
    db
      .select({
        cycle: s.shootingCycles,
        daysBefore: s.settings.approvalDaysBefore,
      })
      .from(s.shootingCycles)
      .leftJoin(s.settings, eq(s.settings.id, "global"))
      .orderBy(asc(s.shootingCycles.shootDate), asc(s.shootingCycles.id)),
    allLookups(db),
    listVideos(db, actor, {}),
    db
      .select({
        videoId: s.scriptVersions.videoId,
        userId: s.approvalDecisions.userId,
        decision: s.approvalDecisions.decision,
      })
      .from(s.approvalDecisions)
      .innerJoin(
        s.scriptVersions,
        eq(s.scriptVersions.id, s.approvalDecisions.versionId),
      )
      .innerJoin(s.videos, eq(s.videos.id, s.scriptVersions.videoId))
      .where(
        and(
          inArray(s.videos.approvalStatus, AWAITING),
          eq(
            s.scriptVersions.versionNo,
            sql`(select max(m.version_no) from script_versions m where m.video_id = ${s.videos.id})`,
          ),
        ),
      )
      .orderBy(asc(s.approvalDecisions.createdAt)),
    db
      .select({ id: s.users.id, name: s.users.name })
      .from(s.users)
      .where(eq(s.users.role, "leadership")),
  ]);

  const daysBefore = cycleRows[0]?.daysBefore ?? 7;
  const cycles = cycleRows.map((r) => r.cycle);
  const nextCycle =
    cycles.find((c) => c.shootDate !== null && c.shootDate >= today) ??
    [...cycles].sort((a, b) => b.id.localeCompare(a.id))[0];

  const cycleDate = new Map(cycles.map((c) => [c.id, c.shootDate]));
  const byVideo = new Map<
    string,
    { userId: string; decision: "approve" | "return" }[]
  >();
  for (const d of decisions)
    byVideo.set(d.videoId, [
      ...(byVideo.get(d.videoId) ?? []),
      { userId: d.userId, decision: d.decision },
    ]);
  const initialToName = new Map(
    leaders.map((l) => [l.name.charAt(0).toLocaleUpperCase("cs"), l.name]),
  );
  const castOf = (initials: string) =>
    /^\p{Lu}( \+ \p{Lu})+$/u.test(initials)
      ? initials
          .split(" + ")
          .map((i) => initialToName.get(i) ?? i)
          .join(" + ")
      : initials;

  const toItem = (v: (typeof videos)[number]): LeadershipScriptItem => {
    const decided = byVideo.get(v.id) ?? [];
    const waiting = leaders.filter(
      (l) =>
        l.id !== actor.id &&
        !decided.some((d) => d.userId === l.id && d.decision === "approve"),
    );
    const otherName = waiting.length === 1 ? waiting[0].name : null;
    return {
      id: v.id,
      code: v.code,
      title: v.title,
      categoryKey: v.categoryKey,
      cast: castOf(v.castInitials),
      cycleId: v.cycleId,
      month:
        (v.cycleId ? cycleDate.get(v.cycleId)?.slice(0, 7) : null) ??
        v.plannedMonth ??
        null,
      status: leadershipStatus(v, actor.id, decided, otherName),
      dot: leadershipDot(v, actor.id, decided, otherName),
    };
  };
  const group = (items: LeadershipScriptItem[]): LeadershipGroups => {
    const out = emptyGroups();
    for (const item of items) out[item.status.group].push(item);
    return out;
  };

  const wanted = opts.all ? cycles : nextCycle ? [nextCycle] : [];
  const sections: LeadershipSection[] = wanted.map((c) => {
    const items = videos.filter((v) => v.cycleId === c.id).map(toItem);
    const active = items.filter((i) => i.status.group !== "muted");
    const deadline = c.shootDate ? minusDays(c.shootDate, daysBefore) : null;
    const isNext = c.id === nextCycle?.id;
    return {
      id: c.id,
      label: cycleLabel(c),
      shootDate: c.shootDate,
      daysToShoot: c.shootDate
        ? daysUntil(new Date(`${c.shootDate}T12:00:00Z`), now)
        : null,
      approvalDeadline: deadline,
      daysToDeadline: deadline
        ? daysUntil(new Date(`${deadline}T12:00:00Z`), now)
        : null,
      approvedCount: active.filter((i) => i.status.group === "approved").length,
      awaitingCount: active.filter(
        (i) => i.status.group === "me" || i.status.group === "other",
      ).length,
      totalCount: active.length,
      kind: isNext
        ? "next"
        : c.shootDate !== null && c.shootDate < today
          ? "past"
          : "later",
      groups: group(items),
    };
  });
  const rank = { next: 0, later: 1, past: 2 } as const;
  sections.sort(
    (a, b) =>
      rank[a.kind] - rank[b.kind] ||
      (a.shootDate ?? "9999").localeCompare(b.shootDate ?? "9999"),
  );

  const loose = opts.all
    ? videos.filter((v) => v.cycleId === null).map(toItem)
    : [];
  return {
    all: opts.all,
    sections,
    unscheduled: group(loose),
    unscheduledCount: loose.length,
    categories: categoryOptions(lookups),
  };
}

export interface HomeScript {
  id: string;
  code: string;
  title: string;
  dot: LeadershipDot;
}

export interface HomeBox {
  key: string;
  label: string;
  color: string | null;
  textColor: string | null;
  /** Approved scripts (`done`) out of all counted scripts (`total`). */
  done: number;
  total: number;
  toReview: number;
  returned: number;
  scripts: HomeScript[];
}

export interface HomeDayScript extends HomeScript {
  categoryKey: string | null;
  categoryLabel: string | null;
  categoryColor: string | null;
  categoryTextColor: string | null;
}

/** One month in the „Všechny“ view; `month === null` = scripts without any month. */
export interface HomeMonth {
  month: string | null;
  label: string;
  shootDate: string | null;
  daysToShoot: number | null;
  past: boolean;
  total: number;
  toReview: number;
  scripts: HomeDayScript[];
}

export interface LeadershipHome {
  all: boolean;
  /** „Všechny“ only: scripts by month – current/upcoming ascending, then past descending, then without a month. */
  months: HomeMonth[];
  /** The month on the first tab (`YYYY-MM`), its name („Listopad“) and title („Listopad 2026“). */
  month: string;
  monthName: string;
  monthTitle: string;
  shootDate: string | null;
  daysToShoot: number | null;
  boxes: HomeBox[];
}

/** Pure: groups the scripts in scope into one box per category (plus „Bez kategorie“ when needed). */
export function buildHomeBoxes(
  items: LeadershipScriptItem[],
  categories: EditorOptions["categories"],
): HomeBox[] {
  const known = new Set(categories.map((c) => c.key));
  const box = (
    key: string,
    label: string,
    color: string | null,
    textColor: string | null,
  ): HomeBox => {
    const mine = items.filter(
      (i) =>
        i.dot &&
        (key === ""
          ? !i.categoryKey || !known.has(i.categoryKey)
          : i.categoryKey === key),
    );
    const scripts = mine
      .map((i) => ({
        id: i.id,
        code: i.code,
        title: i.title,
        dot: i.dot as LeadershipDot,
      }))
      .sort((a, b) => a.dot.rank - b.dot.rank || a.code.localeCompare(b.code));
    return {
      key,
      label,
      color,
      textColor,
      done: scripts.filter((x) => x.dot.label === "Schváleno").length,
      total: scripts.length,
      toReview: scripts.filter((x) => x.dot.color === "yellow").length,
      returned: scripts.filter((x) => x.dot.color === "red").length,
      scripts,
    };
  };
  const boxes = categories.map((c) =>
    box(c.key, c.label, c.color, c.textColor),
  );
  const rest = box("", "Bez kategorie", null, null);
  return rest.total > 0 ? [...boxes, rest] : boxes;
}

/** Pure: „Všechny“ grouping – one section per month (current/upcoming ascending, past descending), no month last. */
export function buildHomeMonths(
  items: LeadershipScriptItem[],
  shoots: Map<string, { shootDate: string; daysToShoot: number | null }>,
  categories: EditorOptions["categories"],
  todayMonth: string,
): HomeMonth[] {
  const cat = new Map(categories.map((c) => [c.key, c]));
  const keys = [...new Set(items.filter((i) => i.dot).map((i) => i.month))];
  const make = (month: string | null): HomeMonth => {
    const scripts: HomeDayScript[] = items
      .filter((i) => i.dot && i.month === month)
      .map((i) => {
        const c = i.categoryKey ? cat.get(i.categoryKey) : undefined;
        return {
          id: i.id,
          code: i.code,
          title: i.title,
          dot: i.dot as LeadershipDot,
          categoryKey: c?.key ?? null,
          categoryLabel: c?.label ?? null,
          categoryColor: c?.color ?? null,
          categoryTextColor: c?.textColor ?? null,
        };
      })
      .sort((a, b) => a.dot.rank - b.dot.rank || a.code.localeCompare(b.code));
    const shoot = month ? shoots.get(month) : undefined;
    return {
      month,
      label: month ? monthLabel(month) : "Bez měsíce",
      shootDate: shoot?.shootDate ?? null,
      daysToShoot: shoot?.daysToShoot ?? null,
      past: month !== null && month < todayMonth,
      total: scripts.length,
      toReview: scripts.filter((x) => x.dot.color === "yellow").length,
      scripts,
    };
  };
  const dated = keys.filter((k): k is string => k !== null);
  const upcoming = dated.filter((k) => k >= todayMonth).sort();
  const past = dated
    .filter((k) => k < todayMonth)
    .sort()
    .reverse();
  return [...upcoming, ...past, ...(keys.includes(null) ? [null] : [])].map(
    make,
  );
}

/** Leadership home: this month's category boxes (first tab) and all months (second tab). Reuses getLeadershipScripts (5 queries). */
export async function getLeadershipHome(
  db: Db,
  actor: Actor,
  opts: { all: boolean },
  now: Date,
): Promise<LeadershipHome> {
  const data = await getLeadershipScripts(db, actor, { all: true }, now);
  const flat = (g: LeadershipGroups) => Object.values(g).flat();
  const items = [
    ...data.sections.flatMap((c) => flat(c.groups)),
    ...flat(data.unscheduled),
  ];
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
  }).format(now);
  const shoots = new Map<
    string,
    { shootDate: string; daysToShoot: number | null }
  >();
  for (const c of data.sections) {
    const m = c.shootDate?.slice(0, 7);
    if (c.shootDate && m && !shoots.has(m))
      shoots.set(m, { shootDate: c.shootDate, daysToShoot: c.daysToShoot });
  }
  const upcoming = data.sections
    .filter((c) => c.shootDate && c.shootDate >= today)
    .sort((a, b) =>
      (a.shootDate as string).localeCompare(b.shootDate as string),
    )[0];
  const month = upcoming?.shootDate?.slice(0, 7) ?? today.slice(0, 7);
  const shoot = shoots.get(month);
  const name = monthLabel(month);
  return {
    all: opts.all,
    months: opts.all
      ? buildHomeMonths(items, shoots, data.categories, today.slice(0, 7))
      : [],
    month,
    monthName: name.split(" ")[0],
    monthTitle: name,
    shootDate: shoot?.shootDate ?? null,
    daysToShoot: shoot?.daysToShoot ?? null,
    boxes: buildHomeBoxes(
      items.filter((i) => i.month === month),
      data.categories,
    ),
  };
}
