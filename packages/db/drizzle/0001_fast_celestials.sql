CREATE TABLE `brain_item` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`section` text NOT NULL,
	`data` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`source` text DEFAULT 'inference' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `brain_item_workspace_idx` ON `brain_item` (`workspace_id`,`section`,`status`);--> statement-breakpoint
CREATE TABLE `onboarding_card` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`kind` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`answer` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`answered_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `onboarding_session`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `onboarding_card_unique` ON `onboarding_card` (`session_id`,`kind`);--> statement-breakpoint
CREATE TABLE `onboarding_session` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`status` text DEFAULT 'researching' NOT NULL,
	`input` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `onboarding_stage` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`stage` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`job_id` text,
	`error` text,
	`started_at` integer,
	`finished_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `onboarding_session`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `onboarding_stage_unique` ON `onboarding_stage` (`session_id`,`stage`);