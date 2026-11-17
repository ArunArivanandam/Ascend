CREATE TABLE `camps` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`mountain_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`mountain_id`) REFERENCES `mountains`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `camps_mountain_idx` ON `camps` (`mountain_id`);--> statement-breakpoint
CREATE TABLE `checkins` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`session_id` text NOT NULL,
	`skipped` integer NOT NULL,
	`focus` integer,
	`challenge_skill` integer,
	`time_passing` integer,
	`time_to_flow_min` integer,
	`chunk_done` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `checkins_session_idx` ON `checkins` (`session_id`);--> statement-breakpoint
CREATE TABLE `chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`mountain_id` text NOT NULL,
	`camp_id` text NOT NULL,
	`title` text NOT NULL,
	`estimate_min` integer,
	`position` integer NOT NULL,
	`done_at` integer,
	FOREIGN KEY (`mountain_id`) REFERENCES `mountains`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`camp_id`) REFERENCES `camps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `chunks_mountain_idx` ON `chunks` (`mountain_id`);--> statement-breakpoint
CREATE TABLE `mountains` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`name` text NOT NULL,
	`target_date` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`summited_at` integer
);
--> statement-breakpoint
CREATE TABLE `session_events` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`kind` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `session_events_session_idx` ON `session_events` (`session_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`mountain_id` text NOT NULL,
	`chunk_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`flow_seconds` integer,
	`pause_count` integer DEFAULT 0 NOT NULL,
	`exit_count` integer DEFAULT 0 NOT NULL,
	`local_date` text NOT NULL,
	FOREIGN KEY (`mountain_id`) REFERENCES `mountains`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`chunk_id`) REFERENCES `chunks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sessions_local_date_idx` ON `sessions` (`local_date`);