ALTER TABLE `workspace` ADD `user_id` text REFERENCES user(id) ON DELETE cascade;
