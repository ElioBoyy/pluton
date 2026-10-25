ALTER TABLE `job` ADD `cancel_requested` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `person` ADD `email` text;--> statement-breakpoint
ALTER TABLE `person` ADD `email_confidence` integer;--> statement-breakpoint
ALTER TABLE `play` ADD `is_main` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `play` ADD `onboarding_session_id` text;