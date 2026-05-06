import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { language, type Language } from '../schema'

type AppDb = ReturnType<typeof drizzle>

export class LanguageRepository {
  constructor(private db: AppDb) {}

  findByCode(code: string): Language | undefined {
    return this.db.select().from(language).where(eq(language.code, code)).get() as
      | Language
      | undefined
  }

  getAll(): Language[] {
    return this.db.select().from(language).orderBy(language.name).all() as Language[]
  }

  getAllCodes(): string[] {
    return (
      this.db.select({ code: language.code }).from(language).orderBy(language.name).all() as {
        code: string
      }[]
    ).map((r) => r.code)
  }

  getAllNames(): string[] {
    return (
      this.db.select({ name: language.name }).from(language).orderBy(language.name).all() as {
        name: string
      }[]
    ).map((r) => r.name)
  }
}
