ALTER TABLE `user` ADD `auto_top_up_below` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `auto_top_up_credits` integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `auto_top_up_max_per_month` integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `auto_top_up_attempt_at` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `auto_top_up_error` text;