CREATE TABLE `game` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_code_unique` ON `game` (`code`);
--> statement-breakpoint
INSERT INTO `game` (`code`, `name`) VALUES
	('csv', 'CSV'),
	('bg3', 'Baldur''s Gate 3'),
	('skyrim', 'The Elder Scrolls V: Skyrim'),
	('until-then', 'Until Then');
--> statement-breakpoint
ALTER TABLE `mod` ADD `game_id` integer;
--> statement-breakpoint
UPDATE `mod` SET `game_id` = (SELECT `id` FROM `game` WHERE `code` = 'bg3') WHERE `game_id` IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `mod_game_name_unique` ON `mod` (`game_id`, `name`);
--> statement-breakpoint
DROP INDEX IF EXISTS `mod_name_unique`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `dictionary_fts_ai`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `dictionary_fts_ad`;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `dictionary_fts_au`;
--> statement-breakpoint
ALTER TABLE `dictionary` ADD `game_id` integer;
--> statement-breakpoint
UPDATE `dictionary` SET `game_id` = (SELECT `id` FROM `game` WHERE `code` = 'bg3') WHERE `game_id` IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `dictionary_game_idx` ON `dictionary` (`game_id`);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `dictionary_fts_ai` AFTER INSERT ON `dictionary` BEGIN
  INSERT INTO dictionary_fts(rowid, text_language1, text_language2, uid, mod_name)
  VALUES (new.id, new.text_language1, new.text_language2, new.uid, new.mod_name);
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `dictionary_fts_ad` AFTER DELETE ON `dictionary` BEGIN
  INSERT INTO dictionary_fts(dictionary_fts, rowid, text_language1, text_language2, uid, mod_name)
  VALUES ('delete', old.id, old.text_language1, old.text_language2, old.uid, old.mod_name);
END;--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `dictionary_fts_au` AFTER UPDATE ON `dictionary` BEGIN
  INSERT INTO dictionary_fts(dictionary_fts, rowid, text_language1, text_language2, uid, mod_name)
  VALUES ('delete', old.id, old.text_language1, old.text_language2, old.uid, old.mod_name);
  INSERT INTO dictionary_fts(rowid, text_language1, text_language2, uid, mod_name)
  VALUES (new.id, new.text_language1, new.text_language2, new.uid, new.mod_name);
END;
