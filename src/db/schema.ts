import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import type { Anchor } from '@/domain/anchors/remap';
import type { ScriptBody } from '@/domain/script/types';

export type UserRole = 'admin' | 'marketer' | 'leadership' | 'production';

export interface NotifyPrefs {
  email: boolean;
  [key: string]: unknown;
}

export interface SuggestionData {
  replacement: string;
  state: 'pending' | 'accepted' | 'rejected';
  decidedBy?: string | null;
  decidedAt?: string | null;
  reason?: string | null;
}

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  role: text('role').$type<UserRole>().notNull(),
  initials: text('initials').notNull(),
  color: text('color').notNull().default('#DCD9FB'),
  notifyPrefs: jsonb('notify_prefs').$type<NotifyPrefs>().notNull().default({ email: true }),
  createdAt: createdAt(),
});

export const lookupItems = pgTable(
  'lookup_items',
  {
    id: text('id').primaryKey(),
    kind: text('kind').notNull(),
    key: text('key').notNull(),
    label: text('label').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
    sortOrder: integer('sort_order').notNull().default(0),
    archived: boolean('archived').notNull().default(false),
  },
  (t) => [unique('lookup_items_kind_key_unique').on(t.kind, t.key)],
);

export const settings = pgTable('settings', {
  id: text('id').primaryKey(),
  monthlyTarget: integer('monthly_target').notNull().default(16),
  approvalDaysBefore: integer('approval_days_before').notNull().default(7),
  tolerancePp: integer('tolerance_pp').notNull().default(10),
  approvalPolicy: text('approval_policy').notNull().default('all_leadership'),
});

export const shootingCycles = pgTable('shooting_cycles', {
  id: text('id').primaryKey(),
  shootDate: date('shoot_date', { mode: 'string' }),
  plannedVideos: integer('planned_videos').notNull().default(16),
  coversMonths: text('covers_months').array().notNull().default([]),
  clipTarget: text('clip_target').notNull().default('30–40'),
  note: text('note').notNull().default(''),
});

export const series = pgTable('series', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  mainCategoryKey: text('main_category_key'),
  goal: text('goal').notNull().default(''),
  guarantorId: text('guarantor_id').references(() => users.id),
  ownerId: text('owner_id').references(() => users.id),
  plannedEpisodes: integer('planned_episodes'),
  originalPlannedEpisodes: integer('original_planned_episodes'),
  scopeChangeReason: text('scope_change_reason').notNull().default(''),
  startDate: date('start_date', { mode: 'string' }),
  expectedEnd: date('expected_end', { mode: 'string' }),
  note: text('note').notNull().default(''),
  status: text('status').notNull().default('draft'),
  closedBy: text('closed_by').references(() => users.id),
  closedAt: timestamp('closed_at', { withTimezone: true }),
});

export const videos = pgTable(
  'videos',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(),
    title: text('title').notNull(),
    seriesId: text('series_id').references(() => series.id),
    episodeNo: integer('episode_no'),
    cycleId: text('cycle_id').references(() => shootingCycles.id),
    plannedMonth: text('planned_month'),
    categoryKey: text('category_key'),
    treatmentKey: text('treatment_key'),
    profileKey: text('profile_key'),
    characterKey: text('character_key'),
    contentType: text('content_type'),
    originalVideoId: text('original_video_id'),
    intent: text('intent').notNull().default(''),
    goalMetric: text('goal_metric').$type<'shares' | 'saves' | 'comments'>(),
    mainIdea: text('main_idea').notNull().default(''),
    formatKey: text('format_key'),
    isTrialReel: boolean('is_trial_reel').notNull().default(false),
    locationKeys: text('location_keys').array().notNull().default([]),
    cast: text('cast').array().notNull().default([]),
    props: text('props').notNull().default(''),
    ownerId: text('owner_id').references(() => users.id),
    scriptDueDate: date('script_due_date', { mode: 'string' }),
    marketerNote: text('marketer_note').notNull().default(''),
    legacyScriptText: text('legacy_script_text').notNull().default(''),
    externalUrl: text('external_url').notNull().default(''),
    approvalStatus: text('approval_status').notNull().default('draft'),
    approvedBy: text('approved_by').array().notNull().default([]),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    leadershipNote: text('leadership_note').notNull().default(''),
    productionStatus: text('production_status').notNull().default('waiting'),
    shotAt: timestamp('shot_at', { withTimezone: true }),
    rawFootageUrl: text('raw_footage_url').notNull().default(''),
    finalVideoUrl: text('final_video_url').notNull().default(''),
    verdict: text('verdict').notNull().default(''),
    draft: jsonb('draft').$type<ScriptBody>(),
    editingAfterApproval: boolean('editing_after_approval').notNull().default(false),
    /** Version id → rule code → checked. */
    manualChecks: jsonb('manual_checks').$type<Record<string, Record<string, boolean>>>().notNull().default({}),
    lifecycleReason: text('lifecycle_reason').notNull().default(''),
    isSample: boolean('is_sample').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('videos_cycle_idx').on(t.cycleId), index('videos_status_idx').on(t.approvalStatus)],
);

export const scriptVersions = pgTable(
  'script_versions',
  {
    id: text('id').primaryKey(),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id),
    versionNo: integer('version_no').notNull(),
    body: jsonb('body').$type<ScriptBody>().notNull(),
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    origin: text('origin').$type<'submit' | 'accepted_suggestions' | 'import'>().notNull(),
    changeSummary: text('change_summary').notNull().default(''),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [unique('script_versions_video_version_unique').on(t.videoId, t.versionNo)],
);

export const approvalDecisions = pgTable('approval_decisions', {
  id: text('id').primaryKey(),
  versionId: text('version_id')
    .notNull()
    .references(() => scriptVersions.id),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  decision: text('decision').$type<'approve' | 'return'>().notNull(),
  note: text('note').notNull().default(''),
  overrodeWarnings: boolean('overrode_warnings').notNull().default(false),
  createdAt: createdAt(),
});

export const comments = pgTable(
  'comments',
  {
    id: text('id').primaryKey(),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id),
    versionId: text('version_id').references(() => scriptVersions.id),
    parentId: text('parent_id'),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id),
    type: text('type').notNull(),
    body: text('body').notNull(),
    mentions: text('mentions').array().notNull().default([]),
    assigneeId: text('assignee_id').references(() => users.id),
    status: text('status').notNull().default('open'),
    anchor: jsonb('anchor').$type<Anchor>(),
    suggestion: jsonb('suggestion').$type<SuggestionData>(),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('comments_video_idx').on(t.videoId)],
);

export const numberChecks = pgTable('number_checks', {
  id: text('id').primaryKey(),
  videoId: text('video_id')
    .notNull()
    .references(() => videos.id),
  fieldId: text('field_id').notNull(),
  quotedText: text('quoted_text').notNull(),
  status: text('status').$type<'pending' | 'confirmed'>().notNull().default('pending'),
  flaggedBy: text('flagged_by').references(() => users.id),
  confirmedBy: text('confirmed_by').references(() => users.id),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  createdAt: createdAt(),
});

export const viewMarks = pgTable(
  'view_marks',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    videoId: text('video_id')
      .notNull()
      .references(() => videos.id),
    lastSeenVersionId: text('last_seen_version_id').references(() => scriptVersions.id),
    seenAt: timestamp('seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.videoId] })],
);

export const activityLog = pgTable(
  'activity_log',
  {
    id: text('id').primaryKey(),
    actorId: text('actor_id').references(() => users.id),
    videoId: text('video_id').references(() => videos.id),
    entity: text('entity').notNull(),
    entityId: text('entity_id').notNull(),
    action: text('action').notNull(),
    before: jsonb('before').$type<Record<string, unknown>>(),
    after: jsonb('after').$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index('activity_log_video_idx').on(t.videoId)],
);

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  activityId: text('activity_id')
    .notNull()
    .references(() => activityLog.id),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: createdAt(),
});

export const publications = pgTable('publications', {
  id: text('id').primaryKey(),
  videoId: text('video_id')
    .notNull()
    .references(() => videos.id),
  profileKey: text('profile_key').notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
  variant: text('variant').notNull().default('hlavni-verze'),
  url: text('url').notNull().default(''),
  note: text('note').notNull().default(''),
  metrics24h: jsonb('metrics_24h').$type<Record<string, number>>(),
  metrics7d: jsonb('metrics_7d').$type<Record<string, number>>(),
});

export const loginTokens = pgTable('login_tokens', {
  tokenHash: text('token_hash').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
});
