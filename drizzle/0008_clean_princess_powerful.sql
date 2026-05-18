CREATE TABLE `translation_run` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` text,
	`service` text NOT NULL,
	`mod_name` text,
	`source_lang` text NOT NULL,
	`target_lang` text NOT NULL,
	`entries_total` integer DEFAULT 0 NOT NULL,
	`entries_translated` integer DEFAULT 0 NOT NULL,
	`chars_consumed` integer DEFAULT 0 NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`mod_name`) REFERENCES `mod`(`name`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `translation_run_finished_idx` ON `translation_run` (`finished_at`);--> statement-breakpoint
CREATE INDEX `translation_run_service_finished_idx` ON `translation_run` (`service`,`finished_at`);--> statement-breakpoint
CREATE INDEX `translation_run_mod_idx` ON `translation_run` (`mod_name`);--> statement-breakpoint
CREATE TABLE `translation_usage` (
	`service` text PRIMARY KEY NOT NULL,
	`consumed_chars` integer DEFAULT 0 NOT NULL,
	`char_limit` integer DEFAULT 500000 NOT NULL,
	`renewal_at` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
