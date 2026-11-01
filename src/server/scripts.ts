import type { Db } from '@/db/client';
import type { RuleConfig } from '@/domain/checks/rules';
import type { CheckResult } from '@/domain/checks/runChecks';
import { can } from '@/domain/policy/can';
import { emptyScript } from '@/domain/script/template';
import type { ScriptBody } from '@/domain/script/types';
import { canSubmit, isAwaitingDecision, type ApprovalStatus } from '@/domain/workflow/approval';
import type { ScriptMeta } from '@/app/(app)/_components/script-view/types';
import type { Actor } from './actor';
import { rulesFrom } from './checkContext';
import { buildEditorOptions, cyclesAndSeries, type EditorOptions } from './editorOptions';
import { statusOf } from './loaders';
import { buildVideoDetail, loadVideoHead } from './queries';
import {
  approvalProgress,
  reviewPerms,
  toThreadVMs,
  toVersionVMs,
  type NumberCheckVM,
  type ReviewData,
  type ThreadVM,
  type VersionVM,
} from './review';
import { buildScriptMeta } from './scriptMeta';

/** The meta fields the editor changes; keys match `VideoMetaPatch`. */
export interface EditorValues {
  title: string;
  categoryKey: string | null;
  treatmentKey: string | null;
  profileKey: string | null;
  characterKey: string | null;
  cycleId: string | null;
  plannedMonth: string | null;
  seriesId: string | null;
  episodeNo: number | null;
  formatKey: string | null;
  isTrialReel: boolean;
  goalMetric: 'shares' | 'saves' | 'comments' | null;
  locationKeys: string[];
  cast: string[];
  props: string;
  intent: string;
  mainIdea: string;
}

export interface ScriptActions {
  /** Open the editor: the author on a draft, a returned or an unlocked approved script. */
  edit: boolean;
  unlock: boolean;
  submit: boolean;
  /** Postpone or cancel. */
  pause: boolean;
  restore: boolean;
  duplicate: boolean;
  openInReview: boolean;
}

export interface ScriptPageData {
  nowIso: string;
  actor: { id: string; name: string };
  video: {
    id: string;
    code: string;
    title: string;
    status: ApprovalStatus;
    editingAfterApproval: boolean;
    lifecycleReason: string;
    seriesId: string | null;
  };
  /** Latest version, or null before the first submit. */
  latest: { id: string; no: number } | null;
  /** What the script says now: the latest version, or the working draft before the first submit. */
  body: ScriptBody;
  /** Working copy the author edits. */
  draft: ScriptBody;
  /** The draft differs from the latest version. */
  draftAhead: boolean;
  bodies: Record<number, ScriptBody>;
  meta: ScriptMeta;
  hookTypeLabels: Record<string, string>;
  versions: VersionVM[];
  threads: ThreadVM[];
  numberChecks: NumberCheckVM[];
  checks: CheckResult[];
  approval: ReviewData['approval'];
  activity: { text: string; createdAt: string; actorName: string }[];
  users: { id: string; name: string }[];
  perms: ReviewData['perms'];
  actions: ScriptActions;
  values: EditorValues;
  /** Picker options, only when loaded with `options: true`. */
  options?: EditorOptions;
  /** What the editor needs to run the checks on the draft in the browser. */
  checkInput: {
    rules: RuleConfig[];
    personHashtags: Record<string, string>;
    formatStatuses: Record<string, 'verified' | 'untested'>;
    manualChecks: Record<string, boolean>;
  };
}

/**
 * The script page in 6-7 queries (head, then the script's rows in parallel). The editor passes
 * `activity: false` and `options: true`: it needs the pickers but not the activity feed.
 */
export async function loadScriptPage(
  db: Db,
  actor: Actor,
  code: string,
  now: Date,
  opts: { activity?: boolean; options?: boolean } = {},
): Promise<ScriptPageData> {
  const head = await loadVideoHead(db, actor, { code });
  const [detail, extra] = await Promise.all([
    buildVideoDetail(db, actor, head, { activity: opts.activity }),
    opts.options ? cyclesAndSeries(db) : Promise.resolve(null),
  ]);
  const { video, latestVersion: latest } = detail;
  const status = statusOf(video);
  const owner = { ownerId: video.ownerId };
  const body = detail.currentBody ?? emptyScript();
  const draft = detail.draft ?? body;

  const { lookups } = detail.refs;
  const rules = rulesFrom(lookups);
  const { hookTypeLabels, ...meta } = buildScriptMeta(detail);
  const userRows = detail.refs.users.map((u) => ({ id: u.id, name: u.name }));
  const userName = new Map(userRows.map((u) => [u.id, u.name]));

  const personHashtags: Record<string, string> = {};
  for (const l of lookups.filter((x) => x.kind === 'profile' && !x.archived)) {
    const { speaker, hashtag } = l.data;
    if (typeof speaker === 'string' && speaker && typeof hashtag === 'string' && hashtag) personHashtags[speaker] = hashtag;
  }
  const formatStatuses = Object.fromEntries(
    lookups.filter((l) => l.kind === 'format').map((l) => [l.key, l.data.status === 'verified' ? 'verified' : 'untested']),
  ) as Record<string, 'verified' | 'untested'>;

  const paused = status === 'postponed' || status === 'cancelled';
  const mayEdit = can(actor, 'script.edit', owner);
  const actions: ScriptActions = {
    edit: mayEdit && (status === 'draft' || status === 'returned' || (status === 'approved' && video.editingAfterApproval)),
    unlock: can(actor, 'script.unlock', owner) && status === 'approved' && !video.editingAfterApproval,
    submit: can(actor, 'script.submit', owner) && canSubmit({ status, editingAfterApproval: video.editingAfterApproval }),
    pause: can(actor, 'script.lifecycle', owner) && !paused,
    restore: can(actor, 'script.lifecycle', owner) && paused,
    duplicate: can(actor, 'script.create') && video.seriesId !== null,
    openInReview: can(actor, 'approval.decide') && isAwaitingDecision(status),
  };

  return {
    nowIso: now.toISOString(),
    actor: { id: actor.id, name: actor.name },
    video: {
      id: video.id,
      code: video.code,
      title: video.title,
      status,
      editingAfterApproval: video.editingAfterApproval,
      lifecycleReason: video.lifecycleReason,
      seriesId: video.seriesId,
    },
    latest: latest ? { id: latest.id, no: latest.versionNo } : null,
    body,
    draft,
    draftAhead: latest !== null && JSON.stringify(latest.body) !== JSON.stringify(draft),
    bodies: Object.fromEntries(detail.versions.map((v) => [v.versionNo, v.body])),
    meta,
    hookTypeLabels,
    versions: toVersionVMs(detail, detail.allDecisions, userName),
    threads: toThreadVMs(detail, new Map(detail.versions.map((v) => [v.id, v.versionNo]))),
    numberChecks: detail.numberChecks.map((n) => ({
      ...n,
      confirmedAt: n.confirmedAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
    checks: detail.checks,
    approval: approvalProgress(detail, actor.id),
    activity: detail.activity.map((a) => ({ text: a.text, createdAt: a.createdAt.toISOString(), actorName: a.actorName })),
    users: userRows.filter((u) => u.id !== actor.id),
    perms: reviewPerms(actor, video.ownerId, status),
    actions,
    values: {
      title: video.title,
      categoryKey: video.categoryKey,
      treatmentKey: video.treatmentKey,
      profileKey: video.profileKey,
      characterKey: video.characterKey,
      cycleId: video.cycleId,
      plannedMonth: video.plannedMonth,
      seriesId: video.seriesId,
      episodeNo: video.episodeNo,
      formatKey: video.formatKey,
      isTrialReel: video.isTrialReel,
      goalMetric: video.goalMetric,
      locationKeys: video.locationKeys,
      cast: video.cast,
      props: video.props,
      intent: video.intent,
      mainIdea: video.mainIdea,
    },
    options: extra ? buildEditorOptions(lookups, detail.refs.users, extra) : undefined,
    checkInput: { rules, personHashtags, formatStatuses, manualChecks: latest ? (video.manualChecks?.[latest.id] ?? {}) : {} },
  };
}
