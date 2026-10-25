CREATE TABLE `lead_event` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lead_id` text NOT NULL,
	`kind` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `lead`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `lead_event_lead_idx` ON `lead_event` (`lead_id`,`id`);--> statement-breakpoint
CREATE TABLE `lead_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`verdict` text NOT NULL,
	`reasons` text DEFAULT '[]' NOT NULL,
	`comment` text,
	`previous_status` text NOT NULL,
	`withdrawn_at` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lead_id`) REFERENCES `lead`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `lead_feedback_lead_idx` ON `lead_feedback` (`lead_id`);--> statement-breakpoint
CREATE INDEX `lead_feedback_workspace_idx` ON `lead_feedback` (`workspace_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `lead` ADD `pipeline` text;--> statement-breakpoint
ALTER TABLE `lead` ADD `warmness` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `lead` ADD `seen_at` integer;--> statement-breakpoint
ALTER TABLE `person` ADD `email_source` text;--> statement-breakpoint
ALTER TABLE `person` ADD `email_checked_at` integer;--> statement-breakpoint
UPDATE `lead` SET `status` = 'to_review' WHERE `status` = 'new';--> statement-breakpoint
UPDATE `lead` SET `pipeline` = (SELECT `pipeline` FROM `play` WHERE `play`.`id` = `lead`.`play_id`) WHERE `pipeline` IS NULL AND (SELECT `pipeline` FROM `play` WHERE `play`.`id` = `lead`.`play_id`) <> 'waterfall';--> statement-breakpoint
UPDATE `lead` SET `pipeline` = CASE WHEN `signal` LIKE 'Posted about%' THEN 'post_keyword' WHEN `signal` LIKE 'Reacted to%' OR `signal` LIKE 'Commented on%' THEN 'post_watchlist' END WHERE `pipeline` IS NULL;--> statement-breakpoint
UPDATE `lead` SET `warmness` = CASE `pipeline` WHEN 'post_watchlist' THEN 85 WHEN 'post_keyword' THEN 70 WHEN 'company_hiring' THEN 60 WHEN 'funding' THEN 55 WHEN 'company_stack' THEN 40 WHEN 'web_evidence' THEN 35 WHEN 'lookalikes' THEN 25 ELSE 20 END;--> statement-breakpoint
UPDATE `person` SET `email_source` = 'hunter', `email_checked_at` = `updated_at` WHERE `email` IS NOT NULL;--> statement-breakpoint
INSERT INTO `lead_event` (`lead_id`, `kind`, `payload`, `created_at`) SELECT `id`, 'found', json_object('stage', `stage`, 'fit', `fit`, 'runId', `run_id`), `created_at` FROM `lead` WHERE `stage` <> 'disqualified';
