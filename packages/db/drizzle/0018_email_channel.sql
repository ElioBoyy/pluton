ALTER TABLE `enrollment` ADD `channel` text DEFAULT 'linkedin' NOT NULL;--> statement-breakpoint
ALTER TABLE `enrollment` ADD `email_subject` text;--> statement-breakpoint
ALTER TABLE `message_draft` ADD `subject` text;--> statement-breakpoint
ALTER TABLE `outreach_action` ADD `external_id` text;