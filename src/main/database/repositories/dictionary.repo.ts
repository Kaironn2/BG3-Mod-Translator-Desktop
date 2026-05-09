import { and, desc, eq, or, type SQL, sql } from 'drizzle-orm'
import type { drizzle } from 'drizzle-orm/better-sqlite3'
import { dictionaryTextKey, normalizeDictionaryText } from '../../utils/dictionaryText'
import { normalizeLangs } from '../../utils/languages'
import { type DictionaryEntry, dictionary, type NewDictionaryEntry } from '../schema'

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

export interface PaginatedDictionaryResult {
  items: DictionaryEntry[]
  total: number
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
    return this.queryList(filters).all() as DictionaryEntry[]
  }

  listPaginated(
    filters: DictionaryFilters = {},
    page: number,
    pageSize: number
  ): PaginatedDictionaryResult {
    const safePage = Math.max(1, page)
    const safePageSize = Math.max(1, pageSize)
    const where = this.buildFilterWhere(filters)
    const totalRow = where
      ? (this.db.select({ count: sql<number>`count(*)` }).from(dictionary).where(where).get() as
          | { count: number }
          | undefined)
      : (this.db.select({ count: sql<number>`count(*)` }).from(dictionary).get() as
          | { count: number }
          | undefined)

    const total = totalRow?.count ?? 0
    const items = this.queryList(filters)
      .limit(safePageSize)
      .offset((safePage - 1) * safePageSize)
      .all() as DictionaryEntry[]

    return { items, total }
  }

  findByText(
    sourceLang: string,
    targetLang: string,
    sourceText: string
  ): DictionaryEntry | undefined {
    const [l1, l2, swapped] = normalizeLangs(sourceLang, targetLang)
    const sourceKey = dictionaryTextKey(sourceText)

    const rows = this.db
      .select()
      .from(dictionary)
      .where(and(eq(dictionary.language1, l1), eq(dictionary.language2, l2)))
      .orderBy(desc(dictionary.updatedAt), desc(dictionary.id))
      .all() as DictionaryEntry[]

    return rows.find((entry) => this.sourceTextKey(entry, swapped) === sourceKey)
  }

  findByModAndText(
    modName: string,
    sourceLang: string,
    targetLang: string,
    sourceText: string
  ): DictionaryEntry | undefined {
    const [l1, l2, swapped] = normalizeLangs(sourceLang, targetLang)
    const sourceKey = dictionaryTextKey(sourceText)
    const normalizedMod = modName.toLowerCase()

    const rows = this.db
      .select()
      .from(dictionary)
      .where(
        and(
          eq(dictionary.language1, l1),
          eq(dictionary.language2, l2),
          sql`lower(coalesce(${dictionary.modName}, '')) = ${normalizedMod}`
        )
      )
      .orderBy(desc(dictionary.updatedAt), desc(dictionary.id))
      .all() as DictionaryEntry[]

    return rows.find((entry) => this.sourceTextKey(entry, swapped) === sourceKey)
  }

  findByModUidAndText(
    modName: string,
    sourceLang: string,
    targetLang: string,
    uid: string,
    sourceText: string
  ): DictionaryEntry | undefined {
    const [l1, l2, swapped] = normalizeLangs(sourceLang, targetLang)
    const sourceKey = dictionaryTextKey(sourceText)
    const normalizedMod = modName.toLowerCase()

    const rows = this.db
      .select()
      .from(dictionary)
      .where(
        and(
          eq(dictionary.language1, l1),
          eq(dictionary.language2, l2),
          sql`lower(coalesce(${dictionary.modName}, '')) = ${normalizedMod}`,
          eq(dictionary.uid, uid)
        )
      )
      .orderBy(desc(dictionary.updatedAt), desc(dictionary.id))
      .all() as DictionaryEntry[]

    return rows.find((entry) => this.sourceTextKey(entry, swapped) === sourceKey)
  }

  resolveMatch(params: {
    modName?: string | null
    uid?: string | null
    sourceLang: string
    targetLang: string
    sourceText: string
  }): { entry: DictionaryEntry; matchType: DictionaryMatchType } | undefined {
    const modName = params.modName?.trim()
    const uid = params.uid?.trim()
    if (modName) {
      if (uid) {
        const byModAndUid = this.findByModUidAndText(
          modName,
          params.sourceLang,
          params.targetLang,
          uid,
          params.sourceText
        )
        if (byModAndUid) return { entry: byModAndUid, matchType: 'mod-text' }
      }

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
    const uid = params.uid?.trim()

    if (modName && uid) {
      const existing = this.findByModUidAndText(
        modName,
        params.sourceLang,
        params.targetLang,
        uid,
        params.sourceText
      )
      if (existing) {
        this.update(existing.id, params)
        return
      }
    } else if (modName) {
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
      const existing = uid
        ? this.findUnscopedByUidAndText(
            params.sourceLang,
            params.targetLang,
            uid,
            params.sourceText
          )
        : this.findUnscopedByText(params.sourceLang, params.targetLang, params.sourceText)
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
      source: normalizeDictionaryText(swapped ? row.t2 : row.t1),
      target: normalizeDictionaryText(swapped ? row.t1 : row.t2)
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

  private queryList(filters: DictionaryFilters) {
    const where = this.buildFilterWhere(filters)
    const query = this.db.select().from(dictionary)

    if (where) {
      return query.where(where).orderBy(desc(dictionary.updatedAt), desc(dictionary.id))
    }

    return query.orderBy(desc(dictionary.updatedAt), desc(dictionary.id))
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
    const sourceKey = dictionaryTextKey(sourceText)

    const rows = this.db
      .select()
      .from(dictionary)
      .where(
        and(
          eq(dictionary.language1, l1),
          eq(dictionary.language2, l2),
          sql`${dictionary.modName} is null`
        )
      )
      .orderBy(desc(dictionary.updatedAt), desc(dictionary.id))
      .all() as DictionaryEntry[]

    return rows.find((entry) => this.sourceTextKey(entry, swapped) === sourceKey)
  }

  private findUnscopedByUidAndText(
    sourceLang: string,
    targetLang: string,
    uid: string,
    sourceText: string
  ): DictionaryEntry | undefined {
    const [l1, l2, swapped] = normalizeLangs(sourceLang, targetLang)
    const sourceKey = dictionaryTextKey(sourceText)

    const rows = this.db
      .select()
      .from(dictionary)
      .where(
        and(
          eq(dictionary.language1, l1),
          eq(dictionary.language2, l2),
          sql`${dictionary.modName} is null`,
          eq(dictionary.uid, uid)
        )
      )
      .orderBy(desc(dictionary.updatedAt), desc(dictionary.id))
      .all() as DictionaryEntry[]

    return rows.find((entry) => this.sourceTextKey(entry, swapped) === sourceKey)
  }

  private toValues(params: UpsertParams): NewDictionaryEntry {
    const [l1, l2, swapped] = normalizeLangs(params.sourceLang, params.targetLang)
    const sourceText = normalizeDictionaryText(params.sourceText)
    const targetText = normalizeDictionaryText(params.targetText)
    const [text1, text2] = swapped ? [targetText, sourceText] : [sourceText, targetText]

    return {
      language1: l1,
      language2: l2,
      textLanguage1: text1,
      textLanguage2: text2,
      modName: params.modName?.trim() || null,
      uid: params.uid?.trim() || null
    }
  }

  private sourceTextKey(entry: DictionaryEntry, swapped: boolean): string {
    return dictionaryTextKey(swapped ? entry.textLanguage2 : entry.textLanguage1)
  }
}
