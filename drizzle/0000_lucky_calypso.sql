CREATE TABLE `config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
--> statement-breakpoint
CREATE TABLE `dictionary` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`language1` text NOT NULL,
	`language2` text NOT NULL,
	`text_language1` text NOT NULL,
	`text_language2` text NOT NULL,
	`mod_name` text,
	`uid` text,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`language1`) REFERENCES `language`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`language2`) REFERENCES `language`(`code`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`mod_name`) REFERENCES `mod`(`name`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_dict_lang_uid` ON `dictionary` (`language1`,`language2`,`uid`);--> statement-breakpoint
CREATE TABLE `language` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `language_code_unique` ON `language` (`code`);--> statement-breakpoint
CREATE TABLE `mod` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mod_name_unique` ON `mod` (`name`);