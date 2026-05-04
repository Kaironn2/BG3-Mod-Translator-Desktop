import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { app } from 'electron'
import { is } from '@electron-toolkit/utils'
import path from 'path'
import * as schema from './schema'
import { seedLanguages } from './seeds/languages.seed'

type AppDb = ReturnType<typeof drizzle<typeof schema>>

let _db: AppDb | null = null
let _sqlite: Database.Database | null = null

export function getDb(): AppDb {
  if (!_db) {
    const dbPath = path.join(app.getPath('userData'), 'icosa.db')
    _sqlite = new Database(dbPath)
    _sqlite.pragma('journal_mode = WAL')
    _sqlite.pragma('foreign_keys = ON')
    _db = drizzle(_sqlite, { schema })
    migrate(_db, { migrationsFolder: getMigrationsFolder() })
    seedLanguages(_db)
  }
  return _db
}

export function closeDb(): void {
  _sqlite?.close()
  _sqlite = null
  _db = null
}

function getMigrationsFolder(): string {
  const base = is.dev
    ? app.getAppPath()
    : app.getAppPath().replace('app.asar', 'app.asar.unpacked')
  return path.join(base, 'drizzle')
}
