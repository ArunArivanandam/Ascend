CREATE TABLE `day_adherence` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`session_id` text NOT NULL,
	`routine_item_id` text NOT NULL,
	`local_date` text NOT NULL,
	`honoured` integer NOT NULL,
	`source` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`routine_item_id`) REFERENCES `routine_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `day_adherence_session_item_idx` ON `day_adherence` (`session_id`,`routine_item_id`);--> statement-breakpoint
CREATE INDEX `day_adherence_date_idx` ON `day_adherence` (`local_date`);--> statement-breakpoint
CREATE TABLE `device_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `routine_items` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`mountain_id` text NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`position` integer NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`mountain_id`) REFERENCES `mountains`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `routine_items_mountain_idx` ON `routine_items` (`mountain_id`);