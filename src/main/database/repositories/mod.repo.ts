import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { mod, type Mod } from '../schema'

type AppDb = ReturnType<typeof drizzle>

export class ModRepository {
  constructor(private db: AppDb) {}

  findByName(name: string): Mod | undefined {
    return this.db.select().from(mod).where(eq(mod.name, name)).get() as Mod | undefined
  }

  getAll(): Mod[] {
    return this.db.select().from(mod).orderBy(mod.name).all() as Mod[]
  }

  getAllNames(): string[] {
    return (
      this.db.select({ name: mod.name }).from(mod).orderBy(mod.name).all() as { name: string }[]
    ).map((r) => r.name)
  }

  upsert(name: string): void {
    this.db
      .insert(mod)
      .values({ name })
      .onConflictDoUpdate({
        target: mod.name,
        set: { updatedAt: sql`(datetime('now'))` }
      })
      .run()
  }
}
