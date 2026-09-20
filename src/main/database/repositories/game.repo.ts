import { eq } from 'drizzle-orm'
import type { drizzle } from 'drizzle-orm/better-sqlite3'
import { type Game, game } from '../schema'

type AppDb = ReturnType<typeof drizzle>

export class GameRepository {
  constructor(private db: AppDb) {}

  findByCode(code: string): Game | undefined {
    return this.db.select().from(game).where(eq(game.code, code)).get() as Game | undefined
  }

  requireId(code: string): number {
    const row = this.findByCode(code)
    if (!row) throw new Error(`Unknown game: ${code}`)
    return row.id
  }
}
