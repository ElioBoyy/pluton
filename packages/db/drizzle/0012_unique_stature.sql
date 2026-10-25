CREATE TABLE `search_document` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`kind` text NOT NULL,
	`ref_id` text NOT NULL,
	`title` text NOT NULL,
	`subtitle` text,
	`href` text NOT NULL,
	`text` text NOT NULL,
	`hash` text NOT NULL,
	`embedding` F32_BLOB(384),
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `search_document_workspace_idx` ON `search_document` (`workspace_id`,`kind`);