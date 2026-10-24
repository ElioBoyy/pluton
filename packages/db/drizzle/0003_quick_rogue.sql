CREATE TABLE `provider_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `provider_cache_expiry_idx` ON `provider_cache` (`expires_at`);--> statement-breakpoint
CREATE TABLE `provider_call` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`provider` text NOT NULL,
	`operation` text NOT NULL,
	`ok` integer NOT NULL,
	`cost_micro_usd` integer DEFAULT 0 NOT NULL,
	`items` integer DEFAULT 0 NOT NULL,
	`duration_ms` integer NOT NULL,
	`error` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `provider_call_provider_idx` ON `provider_call` (`provider`,`created_at`);