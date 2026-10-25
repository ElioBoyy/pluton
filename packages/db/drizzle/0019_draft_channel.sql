DROP INDEX `draft_campaign_lead_step_idx`;--> statement-breakpoint
ALTER TABLE `message_draft` ADD `channel` text DEFAULT 'linkedin' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `draft_campaign_lead_step_channel_idx` ON `message_draft` (`campaign_id`,`lead_id`,`step_id`,`channel`);--> statement-breakpoint
-- Drafts already written as emails (people without LinkedIn, or carrying a subject) are the email versions.
UPDATE `message_draft` SET `channel` = 'email' WHERE `subject` IS NOT NULL OR `lead_id` IN (SELECT `lead`.`id` FROM `lead` JOIN `person` ON `person`.`id` = `lead`.`person_id` WHERE `person`.`linkedin_url` IS NULL);
