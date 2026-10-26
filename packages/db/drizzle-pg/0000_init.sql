CREATE TABLE "activity_event" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"context" text NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brain_item" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"section" text NOT NULL,
	"data" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"source" text DEFAULT 'inference' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brain_proposal" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"kind" text NOT NULL,
	"section" text,
	"target_item_id" text,
	"base_revision" integer,
	"data" jsonb,
	"question" text,
	"rationale" text NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"answer" text,
	"job_id" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp (3) with time zone
);
--> statement-breakpoint
CREATE TABLE "campaign" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"play_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"steps" jsonb NOT NULL,
	"invite_note" text,
	"invite_expiry_days" integer DEFAULT 7 NOT NULL,
	"send_window" jsonb DEFAULT '{"days":[1,2,3,4,5],"startHour":9,"endHour":18}'::jsonb NOT NULL,
	"language" text,
	"objective" jsonb DEFAULT '{"kind":"none","autoReply":true}'::jsonb NOT NULL,
	"sender_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "copilot_action" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"tool" text NOT NULL,
	"input" jsonb NOT NULL,
	"summary" text NOT NULL,
	"preview" jsonb,
	"status" text DEFAULT 'proposed' NOT NULL,
	"result" jsonb,
	"error" text,
	"decided_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "copilot_conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "copilot_message" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"role" text NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"tool" text,
	"action_id" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_entry" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"workspace_id" text,
	"kind" text DEFAULT 'usage' NOT NULL,
	"purpose" text DEFAULT 'other' NOT NULL,
	"source" text NOT NULL,
	"operation" text NOT NULL,
	"cost_micro_usd" bigint NOT NULL,
	"billed" boolean DEFAULT true NOT NULL,
	"play_id" text,
	"run_id" text,
	"job_id" text,
	"detail" jsonb,
	"note" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_hold" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"run_id" text,
	"play_id" text,
	"reserved_micro_usd" bigint NOT NULL,
	"spent_micro_usd" bigint DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'held' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp (3) with time zone
);
--> statement-breakpoint
CREATE TABLE "crm_export" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"provider" text NOT NULL,
	"lead_id" text NOT NULL,
	"status" text NOT NULL,
	"trigger" text DEFAULT 'manual' NOT NULL,
	"person_external_id" text,
	"company_external_id" text,
	"url" text,
	"error" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollment" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"sender_id" text,
	"status" text DEFAULT 'enrolled' NOT NULL,
	"step_index" integer DEFAULT 0 NOT NULL,
	"next_action_at" timestamp (3) with time zone,
	"undo_until" timestamp (3) with time zone NOT NULL,
	"connected" boolean,
	"invite_sent_at" timestamp (3) with time zone,
	"accepted_at" timestamp (3) with time zone,
	"provider_user_id" text,
	"chat_id" text,
	"channel" text DEFAULT 'linkedin' NOT NULL,
	"email_subject" text,
	"last_reply_check_at" timestamp (3) with time zone,
	"note" text,
	"ended_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"provider" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"account" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"connected_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"run_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp (3) with time zone,
	"locked_by" text,
	"cancel_requested" boolean DEFAULT false NOT NULL,
	"idempotency_key" text,
	"result" jsonb,
	"error" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_event" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"lead_id" text NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"verdict" text NOT NULL,
	"reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"comment" text,
	"previous_status" text NOT NULL,
	"withdrawn_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_finding_run" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"play_id" text NOT NULL,
	"job_id" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"stop_reason" text,
	"target" integer NOT NULL,
	"report" jsonb,
	"error" text,
	"trigger" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp (3) with time zone,
	"finished_at" timestamp (3) with time zone
);
--> statement-breakpoint
CREATE TABLE "lead" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"play_id" text NOT NULL,
	"person_id" text NOT NULL,
	"run_id" text,
	"stage" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"fit" integer NOT NULL,
	"reason" text NOT NULL,
	"signal" text NOT NULL,
	"pipeline" text,
	"warmness" integer DEFAULT 0 NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"seen_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_client" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"version" text,
	"calls" integer DEFAULT 0 NOT NULL,
	"last_tool" text,
	"first_seen_at" timestamp (3) with time zone NOT NULL,
	"last_seen_at" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_draft" (
	"id" text PRIMARY KEY NOT NULL,
	"campaign_id" text NOT NULL,
	"lead_id" text NOT NULL,
	"step_id" text NOT NULL,
	"channel" text DEFAULT 'linkedin' NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"origin" text NOT NULL,
	"review" text DEFAULT 'not_reviewed' NOT NULL,
	"step_revision" integer NOT NULL,
	"skip_reason" text,
	"error" text,
	"sent_at" timestamp (3) with time zone,
	"subject" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"category" text NOT NULL,
	"kind" text NOT NULL,
	"tone" text DEFAULT 'info' NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"payload" jsonb,
	"dedupe_key" text,
	"read_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding_card" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"kind" text NOT NULL,
	"body" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"answer" jsonb,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp (3) with time zone
);
--> statement-breakpoint
CREATE TABLE "onboarding_session" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"status" text DEFAULT 'researching' NOT NULL,
	"input" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp (3) with time zone
);
--> statement-breakpoint
CREATE TABLE "onboarding_stage" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"stage" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"job_id" text,
	"error" text,
	"started_at" timestamp (3) with time zone,
	"finished_at" timestamp (3) with time zone
);
--> statement-breakpoint
CREATE TABLE "outreach_action" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"enrollment_id" text NOT NULL,
	"sender_id" text,
	"step_id" text,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"text" text,
	"detail" text,
	"external_id" text,
	"done_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"company" text,
	"company_website" text,
	"linkedin_url" text,
	"location" text,
	"email" text,
	"email_confidence" integer,
	"email_source" text,
	"email_checked_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "play" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"is_main" boolean DEFAULT false NOT NULL,
	"onboarding_session_id" text,
	"ask" text NOT NULL,
	"summary" jsonb NOT NULL,
	"pipeline" text NOT NULL,
	"definition" jsonb NOT NULL,
	"brain_snapshot" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"schedule" text DEFAULT 'off' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"last_run_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"value" jsonb NOT NULL,
	"expires_at" timestamp (3) with time zone NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider_call" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"operation" text NOT NULL,
	"ok" boolean NOT NULL,
	"cost_micro_usd" bigint DEFAULT 0 NOT NULL,
	"items" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer NOT NULL,
	"error" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reply" (
	"id" text PRIMARY KEY NOT NULL,
	"enrollment_id" text NOT NULL,
	"external_id" text,
	"text" text NOT NULL,
	"label" text,
	"summary" text,
	"source" text NOT NULL,
	"received_at" timestamp (3) with time zone NOT NULL,
	"handled_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_document" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"kind" text NOT NULL,
	"ref_id" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"href" text NOT NULL,
	"text" text NOT NULL,
	"folded" text NOT NULL,
	"hash" text NOT NULL,
	"embedding" real[],
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sender" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"provider" text NOT NULL,
	"name" text NOT NULL,
	"profile_url" text,
	"external_id" text,
	"status" text DEFAULT 'connected' NOT NULL,
	"error" text,
	"limits" jsonb DEFAULT '{"visits":80,"invites":20,"messages":50}'::jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slack_post" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"ts" text NOT NULL,
	"run_id" text,
	"lead_ids" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stream_event" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"name" text,
	"google_sub" text,
	"apple_sub" text,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"plan" text,
	"subscription_status" text,
	"current_period_end" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_setting" (
	"workspace_id" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"encrypted" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_setting_workspace_id_key_pk" PRIMARY KEY("workspace_id","key")
);
--> statement-breakpoint
CREATE TABLE "workspace" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"icon" text,
	"timezone" text DEFAULT 'Europe/Paris' NOT NULL,
	"language" text,
	"budget" jsonb,
	"notifications" jsonb,
	"user_id" text,
	"opened_at" timestamp (3) with time zone,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activity_event" ADD CONSTRAINT "activity_event_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_item" ADD CONSTRAINT "brain_item_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_proposal" ADD CONSTRAINT "brain_proposal_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brain_proposal" ADD CONSTRAINT "brain_proposal_target_item_id_brain_item_id_fk" FOREIGN KEY ("target_item_id") REFERENCES "public"."brain_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign" ADD CONSTRAINT "campaign_play_id_play_id_fk" FOREIGN KEY ("play_id") REFERENCES "public"."play"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copilot_action" ADD CONSTRAINT "copilot_action_conversation_id_copilot_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."copilot_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copilot_conversation" ADD CONSTRAINT "copilot_conversation_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copilot_message" ADD CONSTRAINT "copilot_message_conversation_id_copilot_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."copilot_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_entry" ADD CONSTRAINT "credit_entry_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_entry" ADD CONSTRAINT "credit_entry_play_id_play_id_fk" FOREIGN KEY ("play_id") REFERENCES "public"."play"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_entry" ADD CONSTRAINT "credit_entry_run_id_lead_finding_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."lead_finding_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_hold" ADD CONSTRAINT "credit_hold_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_hold" ADD CONSTRAINT "credit_hold_run_id_lead_finding_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."lead_finding_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_hold" ADD CONSTRAINT "credit_hold_play_id_play_id_fk" FOREIGN KEY ("play_id") REFERENCES "public"."play"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_export" ADD CONSTRAINT "crm_export_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_export" ADD CONSTRAINT "crm_export_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollment" ADD CONSTRAINT "enrollment_sender_id_sender_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."sender"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration" ADD CONSTRAINT "integration_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job" ADD CONSTRAINT "job_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_event" ADD CONSTRAINT "lead_event_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_feedback" ADD CONSTRAINT "lead_feedback_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_feedback" ADD CONSTRAINT "lead_feedback_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_finding_run" ADD CONSTRAINT "lead_finding_run_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_finding_run" ADD CONSTRAINT "lead_finding_run_play_id_play_id_fk" FOREIGN KEY ("play_id") REFERENCES "public"."play"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_play_id_play_id_fk" FOREIGN KEY ("play_id") REFERENCES "public"."play"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead" ADD CONSTRAINT "lead_run_id_lead_finding_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."lead_finding_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_client" ADD CONSTRAINT "mcp_client_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_draft" ADD CONSTRAINT "message_draft_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_draft" ADD CONSTRAINT "message_draft_lead_id_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_card" ADD CONSTRAINT "onboarding_card_session_id_onboarding_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."onboarding_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_session" ADD CONSTRAINT "onboarding_session_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_stage" ADD CONSTRAINT "onboarding_stage_session_id_onboarding_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."onboarding_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_action" ADD CONSTRAINT "outreach_action_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_action" ADD CONSTRAINT "outreach_action_enrollment_id_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_action" ADD CONSTRAINT "outreach_action_sender_id_sender_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."sender"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person" ADD CONSTRAINT "person_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play" ADD CONSTRAINT "play_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reply" ADD CONSTRAINT "reply_enrollment_id_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_document" ADD CONSTRAINT "search_document_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sender" ADD CONSTRAINT "sender_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_post" ADD CONSTRAINT "slack_post_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_setting" ADD CONSTRAINT "workspace_setting_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_workspace_idx" ON "activity_event" USING btree ("workspace_id","id");--> statement-breakpoint
CREATE INDEX "auth_session_user_idx" ON "auth_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "brain_item_workspace_idx" ON "brain_item" USING btree ("workspace_id","section","status");--> statement-breakpoint
CREATE INDEX "brain_proposal_workspace_idx" ON "brain_proposal" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_play_idx" ON "campaign" USING btree ("play_id");--> statement-breakpoint
CREATE INDEX "copilot_action_conversation_idx" ON "copilot_action" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "copilot_conversation_workspace_idx" ON "copilot_conversation" USING btree ("workspace_id","updated_at");--> statement-breakpoint
CREATE INDEX "copilot_message_conversation_idx" ON "copilot_message" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "credit_entry_ws_idx" ON "credit_entry" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "credit_entry_run_idx" ON "credit_entry" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "credit_entry_play_idx" ON "credit_entry" USING btree ("play_id","created_at");--> statement-breakpoint
CREATE INDEX "credit_hold_ws_idx" ON "credit_hold" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_hold_run_idx" ON "credit_hold" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "crm_export_lead_idx" ON "crm_export" USING btree ("provider","lead_id");--> statement-breakpoint
CREATE INDEX "crm_export_ws_idx" ON "crm_export" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollment_campaign_lead_idx" ON "enrollment" USING btree ("campaign_id","lead_id");--> statement-breakpoint
CREATE INDEX "enrollment_due_idx" ON "enrollment" USING btree ("next_action_at");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_provider_idx" ON "integration" USING btree ("workspace_id","provider");--> statement-breakpoint
CREATE INDEX "job_claim_idx" ON "job" USING btree ("status","run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "job_idempotency_idx" ON "job" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "lead_event_lead_idx" ON "lead_event" USING btree ("lead_id","id");--> statement-breakpoint
CREATE INDEX "lead_feedback_lead_idx" ON "lead_feedback" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_feedback_workspace_idx" ON "lead_feedback" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "run_play_idx" ON "lead_finding_run" USING btree ("play_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_play_person_idx" ON "lead" USING btree ("play_id","person_id");--> statement-breakpoint
CREATE INDEX "lead_workspace_idx" ON "lead" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_client_name_idx" ON "mcp_client" USING btree ("workspace_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "draft_campaign_lead_step_channel_idx" ON "message_draft" USING btree ("campaign_id","lead_id","step_id","channel");--> statement-breakpoint
CREATE INDEX "notification_ws_idx" ON "notification" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_dedupe_idx" ON "notification" USING btree ("dedupe_key");--> statement-breakpoint
CREATE UNIQUE INDEX "onboarding_card_unique" ON "onboarding_card" USING btree ("session_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "onboarding_stage_unique" ON "onboarding_stage" USING btree ("session_id","stage");--> statement-breakpoint
CREATE INDEX "action_sender_idx" ON "outreach_action" USING btree ("sender_id","created_at");--> statement-breakpoint
CREATE INDEX "action_enrollment_idx" ON "outreach_action" USING btree ("enrollment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "person_dedupe_idx" ON "person" USING btree ("workspace_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "provider_cache_expiry_idx" ON "provider_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "provider_call_provider_idx" ON "provider_call" USING btree ("provider","created_at");--> statement-breakpoint
CREATE INDEX "reply_enrollment_idx" ON "reply" USING btree ("enrollment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reply_external_idx" ON "reply" USING btree ("enrollment_id","external_id");--> statement-breakpoint
CREATE INDEX "search_document_workspace_idx" ON "search_document" USING btree ("workspace_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "slack_post_ts_idx" ON "slack_post" USING btree ("channel_id","ts");--> statement-breakpoint
CREATE INDEX "stream_event_channel_idx" ON "stream_event" USING btree ("channel","id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_google_sub_idx" ON "user" USING btree ("google_sub");--> statement-breakpoint
CREATE UNIQUE INDEX "user_apple_sub_idx" ON "user" USING btree ("apple_sub");--> statement-breakpoint
CREATE UNIQUE INDEX "user_stripe_customer_idx" ON "user" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "user_email_idx" ON "user" USING btree ("email");