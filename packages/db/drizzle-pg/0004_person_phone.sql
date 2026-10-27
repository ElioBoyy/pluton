ALTER TABLE "person" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "person" ADD COLUMN "place_checked_at" timestamp (3) with time zone;