import fs from 'node:fs'
import path from 'node:path'
import { is } from '@electron-toolkit/utils'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { app } from 'electron'
import { logError } from '../services/log.service'
import { dictionaryTextKey } from '../utils/dictionaryText'
import * as schema from './schema'
import { seedLanguages } from './seeds/languages.seed'
import { seedPromptSlots } from './seeds/prompt-slots.seed'
import { applySqlitePragmas } from './sqlite-pragmas'

type AppDb = ReturnType<typeof drizzle<typeof schema>>

interface DictionaryTextRow {
  id: number
  text_language1: string
  text_language2: string
}

let _db: AppDb | null = null
let _sqlite: Database.Database | null = null

export function getDbPath(): string {
  return path.join(app.getPath('userData'), 'icosa.db')
}

export function getDb(): AppDb {
  if (!_db) {
    try {
      initDb()
    } catch (err) {
      closeSqlite()
      if (!isMalformed(err)) throw err
      logError('db.init', err, { recovered: 'quarantine-wal' })
      quarantineWal(getDbPath())
      initDb()
    }
  }
  return _db as AppDb
}

export function getSqlite(): Database.Database {
  getDb()
  if (!_sqlite) throw new Error('sqlite is not initialized')
  return _sqlite
}

export function ensureDictionaryFts(): void {
  if (!_sqlite) return
  backfillDictionaryFts(_sqlite)
  try {
    backfillDictionaryTextKeys(_sqlite)
  } catch (err) {
    logError('db.backfillKeys', err)
  }
}

export function closeDb(): void {
  try {
    _sqlite?.pragma('optimize')
  } catch {
    // best-effort; closing still happens below
  }
  closeSqlite()
  _db = null
}

function initDb(): void {
  const dbPath = getDbPath()
  _sqlite = new Database(dbPath)
  applySqlitePragmas(_sqlite)
  _sqlite.prepare('SELECT 1 FROM sqlite_master LIMIT 1').get()
  _db = drizzle(_sqlite, { schema })
  migrate(_db, { migrationsFolder: getMigrationsFolder() })
  seedLanguages(_db)
  seedPromptSlots(_db)
}

function closeSqlite(): void {
  _sqlite?.close()
  _sqlite = null
}

function quarantineWal(dbPath: string): void {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  for (const suffix of ['-wal', '-shm']) {
    const src = `${dbPath}${suffix}`
    if (!fs.existsSync(src)) continue
    fs.renameSync(src, `${src}.corrupt-${stamp}`)
  }
}

function isMalformed(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return /malformed|corrupt/i.test(message)
}

// Backfill text_language1_key / text_language2_key for rows whose text contains XML
// entities (e.g. &apos;, &amp;). The SQL migration uses lower(trim(...)) which cannot
// decode entities, so this pass corrects any affected rows after the migrator runs.
function backfillDictionaryTextKeys(sqlite: Database.Database): void {
  const rows = sqlite
    .prepare(
      "SELECT id, text_language1, text_language2 FROM dictionary WHERE text_language1 LIKE '%&%' OR text_language2 LIKE '%&%'"
    )
    .all() as DictionaryTextRow[]

  if (rows.length === 0) return

  const update = sqlite.prepare(
    'UPDATE dictionary SET text_language1_key = ?, text_language2_key = ? WHERE id = ?'
  )

  sqlite.transaction(() => {
    for (const row of rows) {
      update.run(
        dictionaryTextKey(row.text_language1),
        dictionaryTextKey(row.text_language2),
        row.id
      )
    }
  })()
}

const FTS_SETUP_SQL = `
CREATE VIRTUAL TABLE IF NOT EXISTS dictionary_fts USING fts5(
  text_language1,
  text_language2,
  uid,
  mod_name,
  content='dictionary',
  content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);
CREATE TRIGGER IF NOT EXISTS dictionary_fts_ai AFTER INSERT ON dictionary BEGIN
  INSERT INTO dictionary_fts(rowid, text_language1, text_language2, uid, mod_name)
  VALUES (new.id, new.text_language1, new.text_language2, new.uid, new.mod_name);
END;
CREATE TRIGGER IF NOT EXISTS dictionary_fts_ad AFTER DELETE ON dictionary BEGIN
  INSERT INTO dictionary_fts(dictionary_fts, rowid, text_language1, text_language2, uid, mod_name)
  VALUES ('delete', old.id, old.text_language1, old.text_language2, old.uid, old.mod_name);
END;
CREATE TRIGGER IF NOT EXISTS dictionary_fts_au AFTER UPDATE ON dictionary BEGIN
  INSERT INTO dictionary_fts(dictionary_fts, rowid, text_language1, text_language2, uid, mod_name)
  VALUES ('delete', old.id, old.text_language1, old.text_language2, old.uid, old.mod_name);
  INSERT INTO dictionary_fts(rowid, text_language1, text_language2, uid, mod_name)
  VALUES (new.id, new.text_language1, new.text_language2, new.uid, new.mod_name);
END;
`

function ftsSearchWorks(sqlite: Database.Database): boolean {
  try {
    return Boolean(
      sqlite
        .prepare("SELECT 1 AS ok FROM dictionary_fts WHERE dictionary_fts MATCH 'a*' LIMIT 1")
        .get()
    )
  } catch {
    return false
  }
}

// FTS5 content tables can exist with an empty/corrupt index after a killed migrate.
// Drop and recreate rather than writing through broken triggers.
function backfillDictionaryFts(sqlite: Database.Database): void {
  if (ftsSearchWorks(sqlite)) return

  sqlite.exec('DROP TRIGGER IF EXISTS dictionary_fts_ai')
  sqlite.exec('DROP TRIGGER IF EXISTS dictionary_fts_ad')
  sqlite.exec('DROP TRIGGER IF EXISTS dictionary_fts_au')
  sqlite.exec('DROP TABLE IF EXISTS dictionary_fts')
  sqlite.exec(FTS_SETUP_SQL)
  sqlite.exec("INSERT INTO dictionary_fts(dictionary_fts) VALUES('rebuild')")
}

function getMigrationsFolder(): string {
  const base = is.dev ? app.getAppPath() : app.getAppPath().replace('app.asar', 'app.asar.unpacked')
  return path.join(base, 'drizzle')
}
