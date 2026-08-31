import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

const timestamps = {
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`)
}

export const language = sqliteTable('language', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  code: text('code').unique().notNull(),
  name: text('name').notNull(),
  ...timestamps
})

export const mod = sqliteTable('mod', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').unique().notNull(),
  totalStrings: integer('total_strings').default(0),
  lastFilePath: text('last_file_path'),
  priority: integer('priority'),
  ...timestamps
})

export const modMeta = sqliteTable('mod_meta', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  modId: integer('mod_id')
    .notNull()
    .unique()
    .references(() => mod.id, { onDelete: 'cascade' }),
  metaFilePath: text('meta_file_path').notNull(),
  name: text('name').notNull(),
  folder: text('folder').notNull(),
  author: text('author').notNull(),
  description: text('description').notNull(),
  uuid: text('uuid').notNull(),
  versionMajor: integer('version_major').notNull(),
  versionMinor: integer('version_minor').notNull(),
  versionRevision: integer('version_revision').notNull(),
  versionBuild: integer('version_build').notNull(),
  version64: text('version64').notNull(),
  ...timestamps
})

// One row per original localization file inside a mod (e.g. Spells.xml, Names.xml,
// translation_merged.xml). Dictionary rows reference this so exports can rebuild the
// original per-file split with the original names. file_type: 'xml' | 'loca'.
export const modSource = sqliteTable(
  'mod_source',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    modId: integer('mod_id')
      .notNull()
      .references(() => mod.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    fileType: text('file_type').notNull().default('xml'),
    ...timestamps
  },
  (table) => ({
    mod_source_mod_file_unique: index('mod_source_mod_file_unique').on(
      table.modId,
      table.fileName
    ),
    mod_source_file_name_idx: index('mod_source_file_name_idx').on(table.fileName)
  })
)

// Invariant: language1 < language2 (alphabetically sorted) - prevents mirrored duplicates.
// UID is metadata only. Matching and persistence are based on mod + source text, then source text.
export const dictionary = sqliteTable(
  'dictionary',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    language1: text('language1')
      .notNull()
      .references(() => language.code),
    language2: text('language2')
      .notNull()
      .references(() => language.code),
    textLanguage1: text('text_language1').notNull(),
    textLanguage2: text('text_language2').notNull(),
    textLanguage1Key: text('text_language1_key').notNull().default(''),
    textLanguage2Key: text('text_language2_key').notNull().default(''),
    modName: text('mod_name').references(() => mod.name),
    uid: text('uid'),
    // Original localization file this row came from (mod_source). New writes set it;
    // legacy rows stay NULL (= merged file) and every query must tolerate that.
    sourceFileId: integer('source_file_id'),
    ...timestamps
  },
  (table) => ({
    dictionary_langs_idx: index('dictionary_langs_idx').on(table.language1, table.language2),
    dictionary_langs_mod_idx: index('dictionary_langs_mod_idx').on(
      table.language1,
      table.language2,
      table.modName
    ),
    dictionary_mod_idx: index('dictionary_mod_idx').on(table.modName),
    dictionary_match_idx: index('dictionary_match_idx').on(
      table.language1,
      table.language2,
      table.modName,
      table.textLanguage1Key
    ),
    dictionary_match_uid_idx: index('dictionary_match_uid_idx').on(
      table.language1,
      table.language2,
      table.modName,
      table.uid,
      table.textLanguage1Key
    )
  })
)

export const config = sqliteTable('config', {
  key: text('key').primaryKey(),
  value: text('value')
})

// Named AI prompt slots (ID · NAME · PROMPT). The seeded default (isDefault=1) is locked:
// editing it in the UI forks a new row instead of overwriting it.
export const promptSlot = sqliteTable('prompt_slot', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  prompt: text('prompt').notNull(),
  isDefault: integer('is_default').notNull().default(0),
  ...timestamps
})

export const translationUsage = sqliteTable('translation_usage', {
  service: text('service').primaryKey(),
  consumedChars: integer('consumed_chars').notNull().default(0),
  charLimit: integer('char_limit').notNull().default(500000),
  renewalAt: text('renewal_at').notNull(),
  ...timestamps
})

export const translationRun = sqliteTable(
  'translation_run',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    jobId: text('job_id'),
    service: text('service').notNull(),
    modName: text('mod_name').references(() => mod.name),
    sourceLang: text('source_lang').notNull(),
    targetLang: text('target_lang').notNull(),
    entriesTotal: integer('entries_total').notNull().default(0),
    entriesTranslated: integer('entries_translated').notNull().default(0),
    charsConsumed: integer('chars_consumed').notNull().default(0),
    startedAt: text('started_at').notNull(),
    finishedAt: text('finished_at').notNull(),
    ...timestamps
  },
  (table) => ({
    translation_run_finished_idx: index('translation_run_finished_idx').on(table.finishedAt),
    translation_run_service_finished_idx: index('translation_run_service_finished_idx').on(
      table.service,
      table.finishedAt
    ),
    translation_run_mod_idx: index('translation_run_mod_idx').on(table.modName)
  })
)

export type Language = typeof language.$inferSelect
export type Mod = typeof mod.$inferSelect
export type ModMeta = typeof modMeta.$inferSelect
export type NewModMeta = typeof modMeta.$inferInsert
export type ModSource = typeof modSource.$inferSelect
export type NewModSource = typeof modSource.$inferInsert
export type DictionaryEntry = typeof dictionary.$inferSelect
export type NewDictionaryEntry = typeof dictionary.$inferInsert
export type TranslationUsage = typeof translationUsage.$inferSelect
export type NewTranslationUsage = typeof translationUsage.$inferInsert
export type TranslationRun = typeof translationRun.$inferSelect
export type NewTranslationRun = typeof translationRun.$inferInsert
export type PromptSlotRow = typeof promptSlot.$inferSelect
export type NewPromptSlotRow = typeof promptSlot.$inferInsert
