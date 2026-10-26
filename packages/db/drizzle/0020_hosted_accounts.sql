CREATE TABLE `auth_session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `auth_session_user_idx` ON `auth_session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`name` text,
	`google_sub` text,
	`apple_sub` text,
	`stripe_customer_id` text,
	`stripe_subscription_id` text,
	`plan` text,
	`subscription_status` text,
	`current_period_end` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_google_sub_idx` ON `user` (`google_sub`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_apple_sub_idx` ON `user` (`apple_sub`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_stripe_customer_idx` ON `user` (`stripe_customer_id`);--> statement-breakpoint
CREATE INDEX `user_email_idx` ON `user` (`email`);