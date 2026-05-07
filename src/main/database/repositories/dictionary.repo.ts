import { and, desc, eq, or, sql, type SQL } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { normalizeLangs } from '../../utils/languages'
import { dictionary, type DictionaryEntry, type NewDictionaryEntry } from '../schema'

type AppDb = ReturnType<typeof drizzle>

export interface SimilarityRow {
  source: string
  target: string
}

export interface DictionaryFilters {
  text?: string
  modName?: string
  sourceLang?: string
  targetLang?: string
}

export interface UpsertParams {
  sourceLang: string
  targetLang: string
  sourceText: string
  targetText: string
  modName?: string | null
  uid?: string | null
}

export type DictionaryMatchType = 'mod-text' | 'text'

export function getDictionaryTargetText(
  entry: { language1: string; textLanguage1: string; textLanguage2: string },
  sourceLang: string,
  targetLang: string
): string {
  const [firstLang] = [sourceLang, targetLang].sort()
  return entry.language1 === firstLang && sourceLang === firstLang
    ? entry.textLanguage2
    : entry.textLanguage1
}

export class DictionaryRepository {
  constructor(private db: AppDb) {}

  list(filters: DictionaryFilters = {}): DictionaryEntry[] {
    const where = this.buildFilterWhere(filters)
    const query = this.db.select().from(dictionary)

    if (where) {
      return query
        .where(where)
        .orderBy(desc(dictionary.updatedAt), desc(dictionary.id))
        .all() as DictionaryEntry[]
    }

    return query.orderBy(desc(dictionary.updatedAt), desc(dictionary.id)).all() as DictionaryEntry[]
  }

  findByText(
    sourceLang: string,
    targetLang: string,
    sourceText: string
  ): DictionaryEntry | undefined {
    const [l1, l2, swapped] = normalizeLangs(sourceLang, targetLang)
    const col = swapped ? dictionary.textLanguage2 : dictionary.textLanguage1
    const normalizedText = sourceText.toLowerCase()

    return this.db
      .select()
      .from(dictionary)
      .where(
        and(
          eq(dictionary.language1, l1),
          eq(dictionary.language2, l2),
          sql`lower(${col}) = ${normalizedText}`
        )
      )
      .orderBy(desc(dictionary.updatedAt), desc(dictionary.id))
      .get() as DictionaryEntry | undefined
  }

  findByModAndText(
    modName: string,
    sourceLang: string,
    targetLang: string,
    sourceText: string
  ): DictionaryEntry | undefined {
    const [l1, l2, swapped] = normalizeLangs(sourceLang, targetLang)
    const col = swapped ? dictionary.textLanguage2 : dictionary.textLanguage1
    const normalizedText = sourceText.toLowerCase()
    const normalizedMod = modName.toLowerCase()

    return this.db
      .select()
      .from(dictionary)
      .where(
        and(
          eq(dictionary.language1, l1),
          eq(dictionary.language2, l2),
          sql`lower(coalesce(${dictionary.modName}, '')) = ${normalizedMod}`,
          sql`lower(${col}) = ${normalizedText}`
        )
      )
      .orderBy(desc(dictionary.updatedAt), desc(dictionary.id))
      .get() as DictionaryEntry | undefined
  }

  resolveMatch(params: {
    modName?: string | null
    sourceLang: string
    targetLang: string
    sourceText: string
  }): { entry: DictionaryEntry; matchType: DictionaryMatchType } | undefined {
    const modName = params.modName?.trim()
    if (modName) {
      const byMod = this.findByModAndText(
        modName,
        params.sourceLang,
        params.targetLang,
        params.sourceText
      )
      if (byMod) return { entry: byMod, matchType: 'mod-text' }
    }

    const byText = this.findByText(params.sourceLang, params.targetLang, params.sourceText)
    if (byText) return { entry: byText, matchType: 'text' }

    return undefined
  }

  create(params: UpsertParams): void {
    this.db.insert(dictionary).values(this.toValues(params)).run()
  }

  update(id: number, params: UpsertParams): void {
    this.db
      .update(dictionary)
      .set({
        ...this.toValues(params),
        updatedAt: sql`(datetime('now'))`
      })
      .where(eq(dictionary.id, id))
      .run()
  }

  upsert(params: UpsertParams): void {
    const modName = params.modName?.trim()

    if (modName) {
      const existing = this.findByModAndText(
        modName,
        params.sourceLang,
        params.targetLang,
        params.sourceText
      )
      if (existing) {
        this.update(existing.id, params)
        return
      }
    } else {
      const existing = this.findUnscopedByText(
        params.sourceLang,
        params.targetLang,
        params.sourceText
      )
      if (existing) {
        this.update(existing.id, params)
        return
      }
    }

    this.create(params)
  }

  getAll(lang1: string, lang2: string): DictionaryEntry[] {
    const [l1, l2] = normalizeLangs(lang1, lang2)
    return this.db
      .select()
      .from(dictionary)
      .where(and(eq(dictionary.language1, l1), eq(dictionary.language2, l2)))
      .all() as DictionaryEntry[]
  }

  getAllForSimilarity(sourceLang: string, targetLang: string): SimilarityRow[] {
    const [l1, l2, swapped] = normalizeLangs(sourceLang, targetLang)
    const rows = this.db
      .select({ t1: dictionary.textLanguage1, t2: dictionary.textLanguage2 })
      .from(dictionary)
      .where(and(eq(dictionary.language1, l1), eq(dictionary.language2, l2)))
      .all() as { t1: string; t2: string }[]

    return rows.map((row) => ({
      source: swapped ? row.t2 : row.t1,
      target: swapped ? row.t1 : row.t2
    }))
  }

  getByMod(modName: string): DictionaryEntry[] {
    return this.db
      .select()
      .from(dictionary)
      .where(eq(dictionary.modName, modName))
      .all() as DictionaryEntry[]
  }

  countByMod(modName: string, sourceLang: string, targetLang: string): number {
    const [l1, l2] = normalizeLangs(sourceLang, targetLang)
    const result = this.db
      .select({ count: sql<number>`count(*)` })
      .from(dictionary)
      .where(
        and(
          eq(dictionary.language1, l1),
          eq(dictionary.language2, l2),
          eq(dictionary.modName, modName)
        )
      )
      .get() as { count: number } | undefined
    return result?.count ?? 0
  }

  delete(id: number): void {
    this.db.delete(dictionary).where(eq(dictionary.id, id)).run()
  }

  private buildFilterWhere(filters: DictionaryFilters): SQL | undefined {
    const conditions: SQL[] = []
    const text = filters.text?.trim().toLowerCase()
    const modName = filters.modName?.trim()
    const sourceLang = filters.sourceLang?.trim()
    const targetLang = filters.targetLang?.trim()

    if (sourceLang && targetLang) {
      const [l1, l2] = normalizeLangs(sourceLang, targetLang)
      conditions.push(and(eq(dictionary.language1, l1), eq(dictionary.language2, l2)) as SQL)
    } else {
      if (sourceLang) {
        conditions.push(
          or(eq(dictionary.language1, sourceLang), eq(dictionary.language2, sourceLang)) as SQL
        )
      }

      if (targetLang) {
        conditions.push(
          or(eq(dictionary.language1, targetLang), eq(dictionary.language2, targetLang)) as SQL
        )
      }
    }

    if (modName) {
      conditions.push(sql`lower(coalesce(${dictionary.modName}, '')) = ${modName.toLowerCase()}`)
    }

    if (text) {
      const pattern = `%${text}%`
      conditions.push(
        sql`(
          lower(${dictionary.textLanguage1}) like ${pattern}
          or lower(${dictionary.textLanguage2}) like ${pattern}
          or lower(coalesce(${dictionary.uid}, '')) like ${pattern}
          or lower(coalesce(${dictionary.modName}, '')) like ${pattern}
        )`
      )
    }

    if (conditions.length === 0) return undefined
    if (conditions.length === 1) return conditions[0]
    return and(...conditions) as SQL
  }

  private findUnscopedByText(
    sourceLang: string,
    targetLang: string,
    sourceText: string
  ): DictionaryEntry | undefined {
    const [l1, l2, swapped] = normalizeLangs(sourceLang, targetLang)
    const col = swapped ? dictionary.textLanguage2 : dictionary.textLanguage1
    const normalizedText = sourceText.toLowerCase()

    return this.db
      .select()
      .from(dictionary)
      .where(
        and(
          eq(dictionary.language1, l1),
          eq(dictionary.language2, l2),
          sql`${dictionary.modName} is null`,
          sql`lower(${col}) = ${normalizedText}`
        )
      )
      .orderBy(desc(dictionary.updatedAt), desc(dictionary.id))
      .get() as DictionaryEntry | undefined
  }

  private toValues(params: UpsertParams): NewDictionaryEntry {
    const [l1, l2, swapped] = normalizeLangs(params.sourceLang, params.targetLang)
    const [text1, text2] = swapped
      ? [params.targetText, params.sourceText]
      : [params.sourceText, params.targetText]

    return {
      language1: l1,
      language2: l2,
      textLanguage1: text1,
      textLanguage2: text2,
      modName: params.modName?.trim() || null,
      uid: params.uid?.trim() || null
    }
  }
}
