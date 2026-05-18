import { and, desc, gte, lte, type SQL, sql } from 'drizzle-orm'
import type { drizzle } from 'drizzle-orm/better-sqlite3'
import { type NewTranslationRun, type TranslationRun, translationRun } from '../schema'

type AppDb = ReturnType<typeof drizzle>

export interface ListRecentParams {
  limit: number
  service?: TranslationRun['service']
  from?: string
  to?: string
}

export interface AggregateByDayParams {
  from: string
  to: string
  service?: TranslationRun['service']
}

export interface DayAggregate {
  date: string
  entries: number
  chars: number
  runs: number
}

export interface AggregateByModParams {
  from: string
  to: string
  service?: TranslationRun['service']
}

export interface ModAggregate {
  modName: string | null
  entries: number
  runs: number
}

export class TranslationRunRepository {
  constructor(private db: AppDb) {}

  create(input: NewTranslationRun): TranslationRun {
    return this.db.insert(translationRun).values(input).returning().get() as TranslationRun
  }

  listRecent(params: ListRecentParams): TranslationRun[] {
    const conditions = this.buildConditions(params.service, params.from, params.to)

    const query =
      conditions.length > 0
        ? this.db
            .select()
            .from(translationRun)
            .where(and(...conditions))
            .orderBy(desc(translationRun.finishedAt))
            .limit(params.limit)
        : this.db
            .select()
            .from(translationRun)
            .orderBy(desc(translationRun.finishedAt))
            .limit(params.limit)

    return query.all() as TranslationRun[]
  }

  aggregateByDay(params: AggregateByDayParams): DayAggregate[] {
    const conditions = this.buildConditions(params.service, params.from, params.to)

    const baseQuery = this.db
      .select({
        date: sql<string>`date(${translationRun.finishedAt})`,
        entries: sql<number>`sum(${translationRun.entriesTranslated})`,
        chars: sql<number>`sum(${translationRun.charsConsumed})`,
        runs: sql<number>`count(*)`
      })
      .from(translationRun)

    const query =
      conditions.length > 0
        ? baseQuery
            .where(and(...conditions))
            .groupBy(sql`date(${translationRun.finishedAt})`)
            .orderBy(sql`date(${translationRun.finishedAt})`)
        : baseQuery
            .groupBy(sql`date(${translationRun.finishedAt})`)
            .orderBy(sql`date(${translationRun.finishedAt})`)

    return query.all() as DayAggregate[]
  }

  aggregateByMod(params: AggregateByModParams): ModAggregate[] {
    const conditions = this.buildConditions(params.service, params.from, params.to)

    const baseQuery = this.db
      .select({
        modName: translationRun.modName,
        entries: sql<number>`sum(${translationRun.entriesTranslated})`,
        runs: sql<number>`count(*)`
      })
      .from(translationRun)

    const query =
      conditions.length > 0
        ? baseQuery
            .where(and(...conditions))
            .groupBy(translationRun.modName)
            .orderBy(desc(sql`count(*)`))
        : baseQuery.groupBy(translationRun.modName).orderBy(desc(sql`count(*)`))

    return query.all() as ModAggregate[]
  }

  private buildConditions(service?: TranslationRun['service'], from?: string, to?: string): SQL[] {
    const conditions: SQL[] = []
    if (service) conditions.push(sql`${translationRun.service} = ${service}`)
    if (from) conditions.push(gte(translationRun.finishedAt, from) as SQL)
    if (to) conditions.push(lte(translationRun.finishedAt, to) as SQL)
    return conditions
  }
}
