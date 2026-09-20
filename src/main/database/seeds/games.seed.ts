import type { drizzle } from 'drizzle-orm/better-sqlite3'
import { PARSER_CATALOG } from '../../../shared/parsers/catalog'
import { game } from '../schema'

type AppDb = ReturnType<typeof drizzle>

export function seedGames(db: AppDb): void {
  db.insert(game)
    .values(PARSER_CATALOG.map((parser) => ({ code: parser.id, name: parser.name })))
    .onConflictDoNothing()
    .run()
}
