CREATE TABLE `credit_entry` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` text,
	`kind` text DEFAULT 'usage' NOT NULL,
	`purpose` text DEFAULT 'other' NOT NULL,
	`source` text NOT NULL,
	`operation` text NOT NULL,
	`cost_micro_usd` integer NOT NULL,
	`billed` integer DEFAULT true NOT NULL,
	`play_id` text,
	`run_id` text,
	`job_id` text,
	`detail` text,
	`note` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`play_id`) REFERENCES `play`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`run_id`) REFERENCES `lead_finding_run`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `credit_entry_ws_idx` ON `credit_entry` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `credit_entry_run_idx` ON `credit_entry` (`run_id`);--> statement-breakpoint
CREATE INDEX `credit_entry_play_idx` ON `credit_entry` (`play_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `credit_hold` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`run_id` text,
	`play_id` text,
	`reserved_micro_usd` integer NOT NULL,
	`spent_micro_usd` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'held' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`settled_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `lead_finding_run`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`play_id`) REFERENCES `play`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `credit_hold_ws_idx` ON `credit_hold` (`workspace_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `credit_hold_run_idx` ON `credit_hold` (`run_id`);--> statement-breakpoint
CREATE TABLE `notification` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`category` text NOT NULL,
	`kind` text NOT NULL,
	`tone` text DEFAULT 'info' NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`link` text,
	`payload` text,
	`dedupe_key` text,
	`read_at` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notification_ws_idx` ON `notification` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `notification_dedupe_idx` ON `notification` (`dedupe_key`);--> statement-breakpoint
ALTER TABLE `workspace` ADD `budget` text;--> statement-breakpoint
ALTER TABLE `workspace` ADD `notifications` text;