CREATE TABLE `mod_meta` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mod_id` integer NOT NULL,
	`meta_file_path` text NOT NULL,
	`name` text NOT NULL,
	`folder` text NOT NULL,
	`author` text NOT NULL,
	`description` text NOT NULL,
	`uuid` text NOT NULL,
	`version_major` integer NOT NULL,
	`version_minor` integer NOT NULL,
	`version_revision` integer NOT NULL,
	`version_build` integer NOT NULL,
	`version64` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`mod_id`) REFERENCES `mod`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mod_meta_mod_id_unique` ON `mod_meta` (`mod_id`);
