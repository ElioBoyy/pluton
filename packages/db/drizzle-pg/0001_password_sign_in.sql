CREATE TABLE "auth_token" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"email" text NOT NULL,
	"user_id" text,
	"password_hash" text,
	"name" text,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "email_verified_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "auth_token" ADD CONSTRAINT "auth_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_token_email_idx" ON "auth_token" USING btree ("email");