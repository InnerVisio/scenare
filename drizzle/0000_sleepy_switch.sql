CREATE TABLE "activity_log" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_id" text,
	"video_id" text,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"version_id" text NOT NULL,
	"user_id" text NOT NULL,
	"decision" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"overrode_warnings" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"version_id" text,
	"parent_id" text,
	"author_id" text NOT NULL,
	"type" text NOT NULL,
	"body" text NOT NULL,
	"mentions" text[] DEFAULT '{}' NOT NULL,
	"assignee_id" text,
	"status" text DEFAULT 'open' NOT NULL,
	"anchor" jsonb,
	"suggestion" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lookup_items" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	CONSTRAINT "lookup_items_kind_key_unique" UNIQUE("kind","key")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "number_checks" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"field_id" text NOT NULL,
	"quoted_text" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"flagged_by" text,
	"confirmed_by" text,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publications" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"profile_key" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"variant" text DEFAULT 'hlavni-verze' NOT NULL,
	"url" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"metrics_24h" jsonb,
	"metrics_7d" jsonb
);
--> statement-breakpoint
CREATE TABLE "script_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"version_no" integer NOT NULL,
	"body" jsonb NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"origin" text NOT NULL,
	"change_summary" text DEFAULT '' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "script_versions_video_version_unique" UNIQUE("video_id","version_no")
);
--> statement-breakpoint
CREATE TABLE "series" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"main_category_key" text,
	"goal" text DEFAULT '' NOT NULL,
	"guarantor_id" text,
	"owner_id" text,
	"planned_episodes" integer,
	"original_planned_episodes" integer,
	"scope_change_reason" text DEFAULT '' NOT NULL,
	"start_date" date,
	"expected_end" date,
	"note" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"closed_by" text,
	"closed_at" timestamp with time zone,
	CONSTRAINT "series_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY NOT NULL,
	"monthly_target" integer DEFAULT 16 NOT NULL,
	"approval_days_before" integer DEFAULT 7 NOT NULL,
	"tolerance_pp" integer DEFAULT 10 NOT NULL,
	"approval_policy" text DEFAULT 'all_leadership' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shooting_cycles" (
	"id" text PRIMARY KEY NOT NULL,
	"shoot_date" date,
	"planned_videos" integer DEFAULT 16 NOT NULL,
	"covers_months" text[] DEFAULT '{}' NOT NULL,
	"clip_target" text DEFAULT '30–40' NOT NULL,
	"note" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"initials" text NOT NULL,
	"color" text DEFAULT '#DCD9FB' NOT NULL,
	"notify_prefs" jsonb DEFAULT '{"email":true}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"series_id" text,
	"episode_no" integer,
	"cycle_id" text,
	"planned_month" text,
	"category_key" text,
	"treatment_key" text,
	"profile_key" text,
	"character_key" text,
	"content_type" text,
	"original_video_id" text,
	"intent" text DEFAULT '' NOT NULL,
	"goal_metric" text,
	"main_idea" text DEFAULT '' NOT NULL,
	"format_key" text,
	"is_trial_reel" boolean DEFAULT false NOT NULL,
	"location_keys" text[] DEFAULT '{}' NOT NULL,
	"cast" text[] DEFAULT '{}' NOT NULL,
	"props" text DEFAULT '' NOT NULL,
	"owner_id" text,
	"script_due_date" date,
	"marketer_note" text DEFAULT '' NOT NULL,
	"legacy_script_text" text DEFAULT '' NOT NULL,
	"external_url" text DEFAULT '' NOT NULL,
	"approval_status" text DEFAULT 'draft' NOT NULL,
	"approved_by" text[] DEFAULT '{}' NOT NULL,
	"approved_at" timestamp with time zone,
	"leadership_note" text DEFAULT '' NOT NULL,
	"production_status" text DEFAULT 'waiting' NOT NULL,
	"shot_at" timestamp with time zone,
	"raw_footage_url" text DEFAULT '' NOT NULL,
	"final_video_url" text DEFAULT '' NOT NULL,
	"verdict" text DEFAULT '' NOT NULL,
	"draft" jsonb,
	"editing_after_approval" boolean DEFAULT false NOT NULL,
	"manual_checks" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"lifecycle_reason" text DEFAULT '' NOT NULL,
	"is_sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "videos_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "view_marks" (
	"user_id" text NOT NULL,
	"video_id" text NOT NULL,
	"last_seen_version_id" text,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "view_marks_user_id_video_id_pk" PRIMARY KEY("user_id","video_id")
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_version_id_script_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."script_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_decisions" ADD CONSTRAINT "approval_decisions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_version_id_script_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."script_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "login_tokens" ADD CONSTRAINT "login_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_activity_id_activity_log_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activity_log"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "number_checks" ADD CONSTRAINT "number_checks_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "number_checks" ADD CONSTRAINT "number_checks_flagged_by_users_id_fk" FOREIGN KEY ("flagged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "number_checks" ADD CONSTRAINT "number_checks_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publications" ADD CONSTRAINT "publications_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_versions" ADD CONSTRAINT "script_versions_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_versions" ADD CONSTRAINT "script_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_guarantor_id_users_id_fk" FOREIGN KEY ("guarantor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "series" ADD CONSTRAINT "series_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."series"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_cycle_id_shooting_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."shooting_cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "view_marks" ADD CONSTRAINT "view_marks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "view_marks" ADD CONSTRAINT "view_marks_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "view_marks" ADD CONSTRAINT "view_marks_last_seen_version_id_script_versions_id_fk" FOREIGN KEY ("last_seen_version_id") REFERENCES "public"."script_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_log_video_idx" ON "activity_log" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "comments_video_idx" ON "comments" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "videos_cycle_idx" ON "videos" USING btree ("cycle_id");--> statement-breakpoint
CREATE INDEX "videos_status_idx" ON "videos" USING btree ("approval_status");