CREATE TABLE "login_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"attempted_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "login_tokens" ADD COLUMN "kind" text DEFAULT 'magic' NOT NULL;