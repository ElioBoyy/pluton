CREATE TABLE `credit_pack` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`credits` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`stripe_session_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_pack_session_idx` ON `credit_pack` (`stripe_session_id`);--> statement-breakpoint
CREATE INDEX `credit_pack_user_idx` ON `credit_pack` (`user_id`);