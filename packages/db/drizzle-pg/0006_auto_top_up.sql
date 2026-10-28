ALTER TABLE "user" ADD COLUMN "auto_top_up_below" integer;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "auto_top_up_credits" integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "auto_top_up_max_per_month" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "auto_top_up_attempt_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "auto_top_up_error" text;