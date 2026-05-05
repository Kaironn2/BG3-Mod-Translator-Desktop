import { ipcMain } from 'electron'
import { eq, sql } from 'drizzle-orm'
import { getDb } from '../database/connection'
import { config } from '../database/schema'

export function registerConfigHandlers(): void {
  ipcMain.handle('config:get', (_event, { key }: { key: string }) => {
    const db = getDb()
    const row = db.select().from(config).where(eq(config.key, key)).get() as
      | { key: string; value: string | null }
      | undefined
    return { value: row?.value ?? null }
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
    return Object.fromEntries(rows.map((r) => [r.key, r.value ?? '']))
  })
}
