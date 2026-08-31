import { eq, inArray } from 'drizzle-orm'
import type { drizzle } from 'drizzle-orm/better-sqlite3'
import { mod, modSource, type ModSource } from '../schema'

type AppDb = ReturnType<typeof drizzle>

// Resolves (or lazily creates) the mod_source row for a (mod, fileName) pair.
// The unique (mod_id, file_name) index is the dedupe point: when a modder renames a
// file but the UIDs stay the same, the dictionary keeps ONE row per UID and only the
// file reference moves - no second entry is created for the same UID.
export class SourceFileRepository {
  constructor(private db: AppDb) {}

  // Single indexed lookup + rare INSERT. Used on import/save-hot paths - keep it O(log n).
  getOrCreate(modName: string, fileName: string, fileType: 'xml' | 'loca' = 'xml'): number {
    const trimmedMod = modName.trim()
    const trimmedFile = fileName.trim()
    if (!trimmedMod || !trimmedFile) throw new Error('Mod name and file name are required')

    const existing = this.findByName(trimmedMod, trimmedFile)
    if (existing) return existing.id

    // Ensure the mod row exists (mod_source references mod.id).
    this.db.insert(mod).values({ name: trimmedMod }).onConflictDoNothing().run()
    const modRow = this.db.select({ id: mod.id }).from(mod).where(eq(mod.name, trimmedMod)).get()
    if (!modRow) throw new Error(`Failed to resolve mod '${trimmedMod}'`)
    this.db
      .insert(modSource)
      .values({ modId: modRow.id, fileName: trimmedFile, fileType })
      .onConflictDoNothing()
      .run()

    // Re-read covers both the fresh insert and a concurrent-insert race.
    const created = this.findByName(trimmedMod, trimmedFile)
    if (!created) throw new Error(`Failed to create source file '${trimmedFile}'`)
    return created.id
  }

  // Case-insensitive lookup (file names arrive from paks with inconsistent casing).
  findByName(modName: string, fileName: string): ModSource | undefined {
    const modId = this.resolveModId(modName)
    if (modId < 0) return undefined
    const rows = this.listByModId(modId)
    const needle = fileName.toLowerCase()
    return rows.find((row) => row.fileName.toLowerCase() === needle)
  }

  listByMod(modName: string): ModSource[] {
    const modId = this.resolveModId(modName)
    if (modId < 0) return []
    return this.listByModId(modId)
  }

  listByIds(ids: number[]): ModSource[] {
    if (ids.length === 0) return []
    return this.db
      .select()
      .from(modSource)
      .where(inArray(modSource.id, ids))
      .all() as ModSource[]
  }

  private resolveModId(modName: string): number {
    const trimmed = modName.trim()
    if (!trimmed) return -1
    const row = this.db.select({ id: mod.id }).from(mod).where(eq(mod.name, trimmed)).get()
    return row?.id ?? -1
  }

  private listByModId(modId: number): ModSource[] {
    return this.db.select().from(modSource).where(eq(modSource.modId, modId)).all() as ModSource[]
  }
}