import { eq, sql } from 'drizzle-orm'
import type { drizzle } from 'drizzle-orm/better-sqlite3'
import { type ModMeta, mod, modMeta } from '../schema'

type AppDb = ReturnType<typeof drizzle>

export interface ModMetaInput {
  metaFilePath: string
  name: string
  folder: string
  author: string
  description: string
  uuid: string
  versionMajor: number
  versionMinor: number
  versionRevision: number
  versionBuild: number
  version64: string
}

export class ModMetaRepository {
  constructor(private db: AppDb) {}

  findByModName(modName: string): ModMeta | undefined {
    return this.db
      .select({ meta: modMeta })
      .from(modMeta)
      .innerJoin(mod, eq(modMeta.modId, mod.id))
      .where(eq(mod.name, modName))
      .get()?.meta as ModMeta | undefined
  }

  upsertForModName(modName: string, input: ModMetaInput): ModMeta {
    const modRow = this.db.select().from(mod).where(eq(mod.name, modName)).get()
    if (!modRow) throw new Error(`Mod not found: ${modName}`)

    this.db
      .insert(modMeta)
      .values({ modId: modRow.id, ...input })
      .onConflictDoUpdate({
        target: modMeta.modId,
        set: {
          ...input,
          updatedAt: sql`(datetime('now'))`
        }
      })
      .run()

    const saved = this.findByModName(modName)
    if (!saved) throw new Error(`Failed to save meta for mod: ${modName}`)
    return saved
  }
}
