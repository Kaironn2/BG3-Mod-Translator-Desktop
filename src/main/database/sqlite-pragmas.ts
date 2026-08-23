import type Database from 'better-sqlite3'

export function applySqlitePragmas(sqlite: Database.Database): void {
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('synchronous = NORMAL')
  sqlite.pragma('cache_size = -64000')
  sqlite.pragma('temp_store = MEMORY')
  sqlite.pragma('busy_timeout = 5000')
}
