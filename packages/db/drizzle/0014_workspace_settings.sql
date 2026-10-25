CREATE TABLE `workspace_setting` (
	`workspace_id` text NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`encrypted` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	PRIMARY KEY(`workspace_id`, `key`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `workspace` ADD `opened_at` integer;--> statement-breakpoint
INSERT OR REPLACE INTO `workspace_setting` (`workspace_id`, `key`, `value`, `encrypted`, `updated_at`) SELECT `workspace`.`id`, `setting`.`key`, `setting`.`value`, `setting`.`encrypted`, `setting`.`updated_at` FROM `setting` CROSS JOIN `workspace`;
