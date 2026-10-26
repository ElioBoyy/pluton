CREATE TABLE "credit_pack" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"credits" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"stripe_session_id" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credit_pack" ADD CONSTRAINT "credit_pack_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "credit_pack_session_idx" ON "credit_pack" USING btree ("stripe_session_id");--> statement-breakpoint
CREATE INDEX "credit_pack_user_idx" ON "credit_pack" USING btree ("user_id");