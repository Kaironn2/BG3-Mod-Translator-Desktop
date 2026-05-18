import { eq, sql } from 'drizzle-orm'
import type { drizzle } from 'drizzle-orm/better-sqlite3'
import { type TranslationUsage, translationUsage } from '../schema'

type AppDb = ReturnType<typeof drizzle>
type Service = 'deepl' | 'google'

export interface UpsertDefaultsOptions {
  charLimit: number
  renewalAt: string
}

export class TranslationUsageRepository {
  constructor(private db: AppDb) {}

  findByService(service: Service): TranslationUsage | undefined {
    return this.db
      .select()
      .from(translationUsage)
      .where(eq(translationUsage.service, service))
      .get() as TranslationUsage | undefined
  }

  // Insert with supplied defaults if missing; return existing row as-is if present.
  upsertDefaults(service: Service, options: UpsertDefaultsOptions): TranslationUsage {
    const existing = this.findByService(service)
    if (existing) return existing

    this.db
      .insert(translationUsage)
      .values({
        service,
        charLimit: options.charLimit,
        renewalAt: options.renewalAt,
        consumedChars: 0
      })
      .run()

    return this.findByService(service) as TranslationUsage
  }

  setLimit(service: Service, charLimit: number): TranslationUsage {
    this.db
      .update(translationUsage)
      .set({ charLimit, updatedAt: sql`(datetime('now'))` })
      .where(eq(translationUsage.service, service))
      .run()

    return this.findByService(service) as TranslationUsage
  }

  setRenewalAt(service: Service, renewalAt: string): TranslationUsage {
    this.db
      .update(translationUsage)
      .set({ renewalAt, updatedAt: sql`(datetime('now'))` })
      .where(eq(translationUsage.service, service))
      .run()

    return this.findByService(service) as TranslationUsage
  }

  // Allow zero; throw on negative.
  setConsumed(service: Service, consumedChars: number): TranslationUsage {
    if (consumedChars < 0) {
      throw new Error(`consumedChars must be >= 0, got ${consumedChars}`)
    }

    this.db
      .update(translationUsage)
      .set({ consumedChars, updatedAt: sql`(datetime('now'))` })
      .where(eq(translationUsage.service, service))
      .run()

    return this.findByService(service) as TranslationUsage
  }

  // Atomically increment consumed_chars. Throw on negative delta.
  addConsumed(service: Service, delta: number): TranslationUsage {
    if (delta < 0) {
      throw new Error(`delta must be >= 0, got ${delta}`)
    }

    return this.db.transaction((tx) => {
      tx.update(translationUsage)
        .set({
          consumedChars: sql`${translationUsage.consumedChars} + ${delta}`,
          updatedAt: sql`(datetime('now'))`
        })
        .where(eq(translationUsage.service, service))
        .run()

      return tx
        .select()
        .from(translationUsage)
        .where(eq(translationUsage.service, service))
        .get() as TranslationUsage
    })
  }

  // Reset consumed to 0 and advance the renewal date, atomically.
  reset(service: Service, nextRenewalAt: string): TranslationUsage {
    return this.db.transaction((tx) => {
      tx.update(translationUsage)
        .set({
          consumedChars: 0,
          renewalAt: nextRenewalAt,
          updatedAt: sql`(datetime('now'))`
        })
        .where(eq(translationUsage.service, service))
        .run()

      return tx
        .select()
        .from(translationUsage)
        .where(eq(translationUsage.service, service))
        .get() as TranslationUsage
    })
  }
}
