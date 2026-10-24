CREATE TABLE `activity_event` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` text NOT NULL,
	`context` text NOT NULL,
	`kind` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `activity_workspace_idx` ON `activity_event` (`workspace_id`,`id`);--> statement-breakpoint
CREATE TABLE `job` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text,
	`type` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`run_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`locked_at` integer,
	`locked_by` text,
	`idempotency_key` text,
	`result` text,
	`error` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `job_claim_idx` ON `job` (`status`,`run_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `job_idempotency_idx` ON `job` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `stream_event` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`channel` text NOT NULL,
	`type` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `stream_event_channel_idx` ON `stream_event` (`channel`,`id`);--> statement-breakpoint
CREATE TABLE `workspace` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`website` text,
	`icon` text,
	`timezone` text DEFAULT 'Europe/Paris' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
