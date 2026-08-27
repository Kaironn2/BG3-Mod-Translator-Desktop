import { asc, eq, isNotNull, sql } from 'drizzle-orm'
import type { drizzle } from 'drizzle-orm/better-sqlite3'
import { dictionary, type Mod, mod, modMeta, translationRun } from '../schema'

type AppDb = ReturnType<typeof drizzle>

export interface ModUpsertOptions {
  totalStrings?: number
  lastFilePath?: string
}

export class ModRepository {
  constructor(private db: AppDb) {}

  findByName(name: string): Mod | undefined {
    return this.db.select().from(mod).where(eq(mod.name, name)).get() as Mod | undefined
  }

  getAll(): Mod[] {
    return this.db.select().from(mod).orderBy(asc(mod.name)).all() as Mod[]
  }

  getAllNames(): string[] {
    return (
      this.db.select({ name: mod.name }).from(mod).orderBy(asc(mod.name)).all() as {
        name: string
      }[]
    ).map((r) => r.name)
  }

  upsert(name: string, options: ModUpsertOptions = {}): void {
    const { totalStrings, lastFilePath } = options
    this.db
      .insert(mod)
      .values({ name, ...options })
      .onConflictDoUpdate({
        target: mod.name,
        set: {
          ...(totalStrings !== undefined && { totalStrings }),
          ...(lastFilePath !== undefined && { lastFilePath }),
          updatedAt: sql`(datetime('now'))`
        }
      })
      .run()
  }

  // Returns mod names ordered by priority ASC (1 = highest), then name for deterministic ties.
  getPriorityOrdered(): string[] {
    return (
      this.db
        .select({ name: mod.name })
        .from(mod)
        .where(isNotNull(mod.priority))
        .orderBy(asc(mod.priority), asc(mod.name))
        .all() as { name: string }[]
    ).map((r) => r.name)
  }

  // Sets the priority for a single mod. Caller must call compactPriority if rebalancing is needed.
  setPriority(name: string, priority: number | null): void {
    this.db
      .update(mod)
      .set({ priority, updatedAt: sql`(datetime('now'))` })
      .where(eq(mod.name, name))
      .run()
  }

  // Rebalances all priority mods to contiguous 1..N slots, ordered by (priority ASC, name ASC).
  compactPriority(): void {
    this.db.transaction((tx) => {
      const rows = tx
        .select({ name: mod.name, priority: mod.priority })
        .from(mod)
        .where(isNotNull(mod.priority))
        .orderBy(asc(mod.priority), asc(mod.name))
        .all() as { name: string; priority: number }[]

      for (let i = 0; i < rows.length; i++) {
        const newPriority = i + 1
        if (rows[i].priority !== newPriority) {
          tx.update(mod)
            .set({ priority: newPriority, updatedAt: sql`(datetime('now'))` })
            .where(eq(mod.name, rows[i].name))
            .run()
        }
      }
    })
  }

  // Atomically assigns priority 1..N to orderedNames and NULL to all others.
  reorderPriority(orderedNames: string[]): void {
    this.db.transaction((tx) => {
      tx.update(mod).set({ priority: null }).where(isNotNull(mod.priority)).run()
      for (let i = 0; i < orderedNames.length; i++) {
        tx.update(mod)
          .set({ priority: i + 1, updatedAt: sql`(datetime('now'))` })
          .where(eq(mod.name, orderedNames[i]))
          .run()
      }
    })
  }

  // Deletes the mod row (cascades mod_meta) and its dictionary entries in one transaction.
  // Physical file removal is handled by mod-delete.service.ts (task 02).
  delete(name: string): { dictionaryRows: number; hadMeta: boolean } {
    let dictionaryRows = 0
    let hadMeta = false

    this.db.transaction((tx) => {
      const countRow = tx
        .select({ count: sql<number>`count(*)` })
        .from(dictionary)
        .where(eq(dictionary.modName, name))
        .get() as { count: number }
      dictionaryRows = countRow.count

      const metaRow = tx
        .select({ id: modMeta.id })
        .from(modMeta)
        .where(
          eq(modMeta.modId, tx.select({ id: mod.id }).from(mod).where(eq(mod.name, name)).limit(1))
        )
        .get() as { id: number } | undefined
      hadMeta = metaRow != null

      tx.update(translationRun).set({ modName: null }).where(eq(translationRun.modName, name)).run()
      tx.delete(dictionary).where(eq(dictionary.modName, name)).run()
      tx.delete(mod).where(eq(mod.name, name)).run()
    })

    return { dictionaryRows, hadMeta }
  }
}
