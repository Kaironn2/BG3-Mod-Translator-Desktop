import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

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
  ...timestamps
})

// Invariant: language1 < language2 (alphabetically sorted) - prevents mirrored duplicates.
// uid nullable: when present, uniqueness is enforced per (language1, language2, uid).
// When uid is NULL, SQLite treats each NULL as distinct, allowing multiple entries per lang pair.
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
    modName: text('mod_name').references(() => mod.name),
    uid: text('uid'),
    ...timestamps
  },
  (t) => [uniqueIndex('idx_dict_lang_uid').on(t.language1, t.language2, t.uid)]
)

export const config = sqliteTable('config', {
  key: text('key').primaryKey(),
  value: text('value')
})

export type Language = typeof language.$inferSelect
export type Mod = typeof mod.$inferSelect
export type DictionaryEntry = typeof dictionary.$inferSelect
export type NewDictionaryEntry = typeof dictionary.$inferInsert
