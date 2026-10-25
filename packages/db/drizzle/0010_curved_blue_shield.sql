CREATE TABLE `crm_export` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`provider` text NOT NULL,
	`lead_id` text NOT NULL,
	`status` text NOT NULL,
	`trigger` text DEFAULT 'manual' NOT NULL,
	`person_external_id` text,
	`company_external_id` text,
	`url` text,
	`error` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lead_id`) REFERENCES `lead`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `crm_export_lead_idx` ON `crm_export` (`provider`,`lead_id`);--> statement-breakpoint
CREATE INDEX `crm_export_ws_idx` ON `crm_export` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `integration` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`provider` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'disconnected' NOT NULL,
	`account` text,
	`config` text DEFAULT '{}' NOT NULL,
	`error` text,
	`connected_at` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `integration_provider_idx` ON `integration` (`workspace_id`,`provider`);--> statement-breakpoint
CREATE TABLE `mcp_client` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`version` text,
	`calls` integer DEFAULT 0 NOT NULL,
	`last_tool` text,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mcp_client_name_idx` ON `mcp_client` (`workspace_id`,`name`);--> statement-breakpoint
CREATE TABLE `slack_post` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`ts` text NOT NULL,
	`run_id` text,
	`lead_ids` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `slack_post_ts_idx` ON `slack_post` (`channel_id`,`ts`);