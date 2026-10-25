CREATE TABLE `lead_finding_run` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`play_id` text NOT NULL,
	`job_id` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`stop_reason` text,
	`target` integer NOT NULL,
	`report` text,
	`error` text,
	`trigger` text DEFAULT 'manual' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`play_id`) REFERENCES `play`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `run_play_idx` ON `lead_finding_run` (`play_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `lead` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`play_id` text NOT NULL,
	`person_id` text NOT NULL,
	`run_id` text,
	`stage` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`fit` integer NOT NULL,
	`reason` text NOT NULL,
	`signal` text NOT NULL,
	`evidence` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`play_id`) REFERENCES `play`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `person`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `lead_finding_run`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lead_play_person_idx` ON `lead` (`play_id`,`person_id`);--> statement-breakpoint
CREATE INDEX `lead_workspace_idx` ON `lead` (`workspace_id`,`status`);--> statement-breakpoint
CREATE TABLE `person` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`name` text NOT NULL,
	`title` text,
	`company` text,
	`company_website` text,
	`linkedin_url` text,
	`location` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `person_dedupe_idx` ON `person` (`workspace_id`,`dedupe_key`);--> statement-breakpoint
CREATE TABLE `play` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`ask` text NOT NULL,
	`summary` text NOT NULL,
	`pipeline` text NOT NULL,
	`definition` text NOT NULL,
	`brain_snapshot` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`schedule` text DEFAULT 'off' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`last_run_at` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
