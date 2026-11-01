CREATE TABLE "job_runs" (
	"key" text PRIMARY KEY NOT NULL,
	"ran_on" text NOT NULL,
	"ran_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "emailed_at" timestamp with time zone;