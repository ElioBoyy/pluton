CREATE TABLE `campaign` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`play_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`steps` text NOT NULL,
	`invite_note` text,
	`invite_expiry_days` integer DEFAULT 7 NOT NULL,
	`send_window` text DEFAULT '{"days":[1,2,3,4,5],"startHour":9,"endHour":18}' NOT NULL,
	`language` text,
	`objective` text DEFAULT '{"kind":"none","autoReply":true}' NOT NULL,
	`sender_ids` text DEFAULT '[]' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`play_id`) REFERENCES `play`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `campaign_play_idx` ON `campaign` (`play_id`);--> statement-breakpoint
CREATE TABLE `enrollment` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`sender_id` text,
	`status` text DEFAULT 'enrolled' NOT NULL,
	`step_index` integer DEFAULT 0 NOT NULL,
	`next_action_at` integer,
	`undo_until` integer NOT NULL,
	`connected` integer,
	`invite_sent_at` integer,
	`accepted_at` integer,
	`provider_user_id` text,
	`chat_id` text,
	`last_reply_check_at` integer,
	`note` text,
	`ended_at` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lead_id`) REFERENCES `lead`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sender_id`) REFERENCES `sender`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `enrollment_campaign_lead_idx` ON `enrollment` (`campaign_id`,`lead_id`);--> statement-breakpoint
CREATE INDEX `enrollment_due_idx` ON `enrollment` (`next_action_at`);--> statement-breakpoint
CREATE TABLE `message_draft` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`step_id` text NOT NULL,
	`text` text DEFAULT '' NOT NULL,
	`origin` text NOT NULL,
	`review` text DEFAULT 'not_reviewed' NOT NULL,
	`step_revision` integer NOT NULL,
	`skip_reason` text,
	`error` text,
	`sent_at` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaign`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lead_id`) REFERENCES `lead`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `draft_campaign_lead_step_idx` ON `message_draft` (`campaign_id`,`lead_id`,`step_id`);--> statement-breakpoint
CREATE TABLE `outreach_action` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`enrollment_id` text NOT NULL,
	`sender_id` text,
	`step_id` text,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`text` text,
	`detail` text,
	`done_at` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`enrollment_id`) REFERENCES `enrollment`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sender_id`) REFERENCES `sender`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `action_sender_idx` ON `outreach_action` (`sender_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `action_enrollment_idx` ON `outreach_action` (`enrollment_id`);--> statement-breakpoint
CREATE TABLE `reply` (
	`id` text PRIMARY KEY NOT NULL,
	`enrollment_id` text NOT NULL,
	`external_id` text,
	`text` text NOT NULL,
	`label` text,
	`summary` text,
	`source` text NOT NULL,
	`received_at` integer NOT NULL,
	`handled_at` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`enrollment_id`) REFERENCES `enrollment`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reply_enrollment_idx` ON `reply` (`enrollment_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `reply_external_idx` ON `reply` (`enrollment_id`,`external_id`);--> statement-breakpoint
CREATE TABLE `sender` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`provider` text NOT NULL,
	`name` text NOT NULL,
	`profile_url` text,
	`external_id` text,
	`status` text DEFAULT 'connected' NOT NULL,
	`error` text,
	`limits` text DEFAULT '{"visits":80,"invites":20,"messages":50}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
