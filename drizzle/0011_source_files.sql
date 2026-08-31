-- Source-file tracking for per-file localization (Icosa).
-- A mod's localization can span several XML/LOCA files; each dictionary row remembers
-- which original file it came from so exports can rebuild the same split (and names).
CREATE TABLE `mod_source` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`mod_id` integer NOT NULL,
	`file_name` text NOT NULL,
	`file_type` text DEFAULT 'xml' NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`mod_id`) REFERENCES `mod`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mod_source_mod_file_unique` ON `mod_source` (`mod_id`,`file_name`);
--> statement-breakpoint
-- Backfill: every existing dictionary row belongs to the merged XML that imports produce
-- (translation_merged.xml). Rows without a mod keep NULL.
INSERT INTO `mod_source` (`mod_id`, `file_name`, `file_type`)
SELECT m.id, 'translation_merged.xml', 'xml'
FROM `mod` m
WHERE EXISTS (SELECT 1 FROM `dictionary` d WHERE d.`mod_name` = m.name);
--> statement-breakpoint
-- Add the nullable column (existing DBs: all rows start NULL = "unknown/merged").
-- Non-FK on purpose: SQLite cannot ADD COLUMN with a non-NULL foreign key default;
-- the FK is declared in the Drizzle schema and enforced on new writes going forward.
ALTER TABLE `dictionary` ADD `source_file_id` integer;
--> statement-breakpoint
-- Covering index for the per-file listing/grouping: (mod, file) lookups and joins
-- from source_file -> rows. Does not touch existing indexes.
CREATE INDEX IF NOT EXISTS `dictionary_source_file_idx` ON `dictionary` (`source_file_id`);
--> statement-breakpoint
-- Fast file-name resolution per mod for exports (mod_source join).
CREATE INDEX IF NOT EXISTS `mod_source_file_name_idx` ON `mod_source` (`file_name`);