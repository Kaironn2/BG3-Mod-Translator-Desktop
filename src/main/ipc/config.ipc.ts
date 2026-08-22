import { eq, sql } from 'drizzle-orm'
import { ipcMain } from 'electron'
import { DEFAULT_SOURCE_LANG, DEFAULT_TARGET_LANG } from '../../preload/api-types'
import { getDb } from '../database/connection'
import { config, language } from '../database/schema'

const LANG_CONFIG_DEFAULTS: Record<string, string> = {
  last_source_lang: DEFAULT_SOURCE_LANG,
  last_target_lang: DEFAULT_TARGET_LANG
}

export function registerConfigHandlers(): void {
  ipcMain.handle('config:get', (_event, { key }: { key: string }) => {
    const db = getDb()
    const row = db.select().from(config).where(eq(config.key, key)).get() as
      | { key: string; value: string | null }
      | undefined
    return { value: sanitizeLangConfigValue(db, key, row?.value ?? null) }
  })

  ipcMain.handle('config:set', (_event, { key, value }: { key: string; value: string }) => {
    const db = getDb()
    db.insert(config)
      .values({ key, value })
      .onConflictDoUpdate({
        target: config.key,
        set: { value: sql`excluded.value` }
      })
      .run()
    return { success: true }
  })

  ipcMain.handle('config:getAll', () => {
    const db = getDb()
    const rows = db.select().from(config).all() as { key: string; value: string | null }[]
    const all = Object.fromEntries(rows.map((r) => [r.key, r.value ?? '']))
    for (const key of Object.keys(LANG_CONFIG_DEFAULTS)) {
      if (!Object.hasOwn(all, key)) continue
      all[key] = sanitizeLangConfigValue(db, key, all[key]) ?? ''
    }
    return all
  })
}

function knownLanguageCodes(db: ReturnType<typeof getDb>): Set<string> {
  const rows = db.select({ code: language.code }).from(language).all() as { code: string }[]
  return new Set(rows.map((row) => row.code))
}

// Read-only: invalid leftover free-text values (english, ptbr) become defaults.
// Missing/empty and known ISO codes are unchanged. Does not write the store.
function sanitizeLangConfigValue(
  db: ReturnType<typeof getDb>,
  key: string,
  value: string | null
): string | null {
  const fallback = LANG_CONFIG_DEFAULTS[key]
  if (!fallback) return value
  if (!value) return value
  if (knownLanguageCodes(db).has(value)) return value
  return fallback
}
