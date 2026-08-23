CREATE INDEX IF NOT EXISTS `dictionary_list_idx` ON `dictionary` (`language1`,`language2`,`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `dictionary_updated_idx` ON `dictionary` (`updated_at`,`id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `dictionary_key1_lookup_idx` ON `dictionary` (`language1`,`language2`,`text_language1_key`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `dictionary_key2_lookup_idx` ON `dictionary` (`language1`,`language2`,`text_language2_key`);--> statement-breakpoint
CREATE VIRTUAL TABLE IF NOT EXISTS `dictionary_fts` USING fts5(
  text_language1,
  text_language2,
  uid,
  mod_name,
  content='dictionary',
  content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);--> statement-breakpoint
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
