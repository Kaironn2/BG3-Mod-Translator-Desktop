import { and, desc, eq, or, type SQL, sql } from 'drizzle-orm'
import type { drizzle } from 'drizzle-orm/better-sqlite3'
import { dictionaryTextKey, normalizeDictionaryText } from '../../utils/dictionaryText'
import { normalizeLangs } from '../../utils/languages'
import { toFtsQuery } from '../fts-query'
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

export interface DictionaryMatchIndex {
  readonly byModUidKey: Map<string, DictionaryEntry>
  readonly byModKey: Map<string, DictionaryEntry>
  readonly byKey: Map<string, DictionaryEntry>
  resolve(params: {
    modName: string | null
    uid: string | null
    sourceText: string
  }): { entry: DictionaryEntry; matchType: DictionaryMatchType } | undefined
}

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
  private ftsEnabled: boolean | null = null

  constructor(private db: AppDb) {}

  refreshFtsProbe(): void {
    this.ftsEnabled = null
  }

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
    const keyColumn = swapped ? dictionary.textLanguage2Key : dictionary.textLanguage1Key

    return this.db
      .select()
      .from(dictionary)
      .where(
        and(eq(dictionary.language1, l1), eq(dictionary.language2, l2), eq(keyColumn, sourceKey))
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
    const sourceKey = dictionaryTextKey(sourceText)
    const normalizedMod = modName.toLowerCase()
    const keyColumn = swapped ? dictionary.textLanguage2Key : dictionary.textLanguage1Key

    return this.db
      .select()
      .from(dictionary)
      .where(
        and(
          eq(dictionary.language1, l1),
          eq(dictionary.language2, l2),
          sql`lower(coalesce(${dictionary.modName}, '')) = ${normalizedMod}`,
          eq(keyColumn, sourceKey)
        )
      )
      .orderBy(desc(dictionary.updatedAt), desc(dictionary.id))
      .get() as DictionaryEntry | undefined
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
    const keyColumn = swapped ? dictionary.textLanguage2Key : dictionary.textLanguage1Key

    return this.db
      .select()
      .from(dictionary)
      .where(
        and(
          eq(dictionary.language1, l1),
          eq(dictionary.language2, l2),
          sql`lower(coalesce(${dictionary.modName}, '')) = ${normalizedMod}`,
          eq(dictionary.uid, uid),
          eq(keyColumn, sourceKey)
        )
      )
      .orderBy(desc(dictionary.updatedAt), desc(dictionary.id))
      .get() as DictionaryEntry | undefined
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

  loadKeyMap(
    sourceLang: string,
    targetLang: string,
    modName: string
  ): Map<string, { id: number; targetKey: string; uid: string | null }> {
    const [l1, l2, swapped] = normalizeLangs(sourceLang, targetLang)
    const normalizedMod = modName.toLowerCase()

    const rows = this.db
      .select({
        id: dictionary.id,
        uid: dictionary.uid,
        key1: dictionary.textLanguage1Key,
        key2: dictionary.textLanguage2Key
      })
      .from(dictionary)
      .where(
        and(
          eq(dictionary.language1, l1),
          eq(dictionary.language2, l2),
          sql`lower(coalesce(${dictionary.modName}, '')) = ${normalizedMod}`
        )
      )
      .all() as { id: number; uid: string | null; key1: string; key2: string }[]

    const map = new Map<string, { id: number; targetKey: string; uid: string | null }>()
    for (const row of rows) {
      const sourceKey = swapped ? row.key2 : row.key1
      const targetKey = swapped ? row.key1 : row.key2
      map.set(sourceKey, { id: row.id, targetKey, uid: row.uid })
    }
    return map
  }

  // - modName reserved for future scoping; priorityMods (if set) are checked first before the current mod and global fallback
  loadMatchIndex(
    sourceLang: string,
    targetLang: string,
    _modName?: string | null,
    priorityMods?: readonly string[]
  ): DictionaryMatchIndex {
    const [l1, l2, swapped] = normalizeLangs(sourceLang, targetLang)

    const rows = this.db
      .select()
      .from(dictionary)
      .where(and(eq(dictionary.language1, l1), eq(dictionary.language2, l2)))
      .all() as DictionaryEntry[]

    const byModUidKey = new Map<string, DictionaryEntry>()
    const byModKey = new Map<string, DictionaryEntry>()
    const byKey = new Map<string, DictionaryEntry>()

    function newerWins(existing: DictionaryEntry, incoming: DictionaryEntry): boolean {
      const a = existing.updatedAt ?? ''
      const b = incoming.updatedAt ?? ''
      if (b > a) return true
      if (b < a) return false
      return incoming.id > existing.id
    }

    for (const row of rows) {
      const sourceKey = swapped ? row.textLanguage2Key : row.textLanguage1Key
      if (!sourceKey) continue

      const prev = byKey.get(sourceKey)
      if (!prev || newerWins(prev, row)) byKey.set(sourceKey, row)

      if (row.modName) {
        const normalizedMod = row.modName.toLowerCase()
        const modKey = `${normalizedMod}|${sourceKey}`
        const prevMod = byModKey.get(modKey)
        if (!prevMod || newerWins(prevMod, row)) byModKey.set(modKey, row)

        if (row.uid) {
          const modUidKey = `${normalizedMod}|${row.uid}|${sourceKey}`
          const prevModUid = byModUidKey.get(modUidKey)
          if (!prevModUid || newerWins(prevModUid, row)) byModUidKey.set(modUidKey, row)
        }
      }
    }

    // Normalize once at index-build time; never per resolve call
    const normalizedPriority = (priorityMods ?? [])
      .map((m) => m?.trim().toLowerCase())
      .filter((m): m is string => !!m)

    return {
      byModUidKey,
      byModKey,
      byKey,
      resolve(params) {
        const sourceKey = dictionaryTextKey(params.sourceText)

        // Priority mods checked first in order (text only - UIDs are mod-local)
        for (const pm of normalizedPriority) {
          const entry = byModKey.get(`${pm}|${sourceKey}`)
          if (entry) return { entry, matchType: 'mod-text' }
        }

        const normalizedMod = params.modName?.trim().toLowerCase() || null
        if (normalizedMod) {
          const uid = params.uid?.trim()
          if (uid) {
            const entry = byModUidKey.get(`${normalizedMod}|${uid}|${sourceKey}`)
            if (entry) return { entry, matchType: 'mod-text' }
          }
          const entry = byModKey.get(`${normalizedMod}|${sourceKey}`)
          if (entry) return { entry, matchType: 'mod-text' }
        }

        const entry = byKey.get(sourceKey)
        if (entry) return { entry, matchType: 'text' }

        return undefined
      }
    }
  }

  // Single-SELECT + batch INSERT/UPDATE alternative to N sequential upsert calls.
  // Fast path requires all rows to share the same modName (non-null) and language pair.
  // Falls back to per-row upsert when modName is absent.
  bulkUpsert(rows: UpsertParams[]): void {
    if (rows.length === 0) return
    const { sourceLang, targetLang, modName } = rows[0]
    const trimmedModName = modName?.trim() || null

    if (!trimmedModName) {
      for (const row of rows) this.upsert(row)
      return
    }

    const [, , swapped] = normalizeLangs(sourceLang, targetLang)
    const keyMap = this.loadKeyMap(sourceLang, targetLang, trimmedModName)
    const targetColumn: 'language1' | 'language2' = swapped ? 'language1' : 'language2'

    const toInsert: NewDictionaryEntry[] = []
    const toUpdate: {
      id: number
      targetText: string
      targetTextKey: string
      uid: string | null
    }[] = []

    for (const row of rows) {
      const sourceText = normalizeDictionaryText(row.sourceText)
      const targetText = normalizeDictionaryText(row.targetText)
      const sourceKey = dictionaryTextKey(sourceText)
      const existing = keyMap.get(sourceKey)

      if (existing) {
        toUpdate.push({
          id: existing.id,
          targetText,
          targetTextKey: dictionaryTextKey(targetText),
          uid: row.uid?.trim() || existing.uid
        })
      } else {
        toInsert.push(this.toValues(row))
      }
    }

    if (toInsert.length > 0) this.bulkInsert(toInsert)
    if (toUpdate.length > 0) this.bulkUpdate(toUpdate, targetColumn)
  }

  // Multi-row VALUES INSERT in a single transaction. Chunks internally so the bound
  // parameter count stays under SQLite's 999-param cap (8 cols * 100 rows = 800).
  bulkInsert(rows: NewDictionaryEntry[]): void {
    if (rows.length === 0) return
    const CHUNK_SIZE = 100

    this.db.transaction((tx) => {
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE)
        tx.insert(dictionary).values(chunk).run()
      }
    })
  }

  // Per-row UPDATE in a single transaction. uid is COALESCEd so null leaves it untouched.
  bulkUpdate(
    updates: { id: number; targetText: string; targetTextKey: string; uid: string | null }[],
    column: 'language1' | 'language2' = 'language2'
  ): void {
    if (updates.length === 0) return

    this.db.transaction((tx) => {
      for (const u of updates) {
        const setPayload =
          column === 'language1'
            ? { textLanguage1: u.targetText, textLanguage1Key: u.targetTextKey }
            : { textLanguage2: u.targetText, textLanguage2Key: u.targetTextKey }

        tx.update(dictionary)
          .set({
            ...setPayload,
            uid: sql`COALESCE(${u.uid}, ${dictionary.uid})`,
            updatedAt: sql`(datetime('now'))`
          })
          .where(eq(dictionary.id, u.id))
          .run()
      }
    })
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

  countAllByMod(modName: string): number {
    const result = this.db
      .select({ count: sql<number>`count(*)` })
      .from(dictionary)
      .where(eq(dictionary.modName, modName))
      .get() as { count: number } | undefined
    return result?.count ?? 0
  }

  delete(id: number): void {
    this.db.delete(dictionary).where(eq(dictionary.id, id)).run()
  }

  deleteByFilter(filters: DictionaryFilters): { deleted: number } {
    const where = this.buildFilterWhere(filters)
    const result = (
      where ? this.db.delete(dictionary).where(where) : this.db.delete(dictionary)
    ).run() as { changes: number }
    return { deleted: result.changes }
  }

  updateTextByFilter(
    filters: DictionaryFilters,
    patch: { findText: string; replaceText: string; column: 'language1' | 'language2' }
  ): { updated: number } {
    const { sourceLang, targetLang } = filters
    let swapped = false
    if (sourceLang && targetLang) {
      ;[, , swapped] = normalizeLangs(sourceLang, targetLang)
    }

    // user's 'language1' (source) -> textLanguage1 when not swapped, textLanguage2 when swapped
    const useL1 = (patch.column === 'language1') !== swapped
    const filterWhere = this.buildFilterWhere(filters)
    const { findText, replaceText } = patch

    if (useL1) {
      const likeWhere = sql`${dictionary.textLanguage1} like ${`%${findText}%`}`
      const finalWhere = filterWhere ? (and(filterWhere, likeWhere) as SQL) : likeWhere
      const result = this.db
        .update(dictionary)
        .set({
          textLanguage1: sql`replace(${dictionary.textLanguage1}, ${findText}, ${replaceText})`
        })
        .where(finalWhere)
        .run() as { changes: number }
      return { updated: result.changes }
    }

    const likeWhere = sql`${dictionary.textLanguage2} like ${`%${findText}%`}`
    const finalWhere = filterWhere ? (and(filterWhere, likeWhere) as SQL) : likeWhere
    const result = this.db
      .update(dictionary)
      .set({
        textLanguage2: sql`replace(${dictionary.textLanguage2}, ${findText}, ${replaceText})`
      })
      .where(finalWhere)
      .run() as { changes: number }
    return { updated: result.changes }
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
      const ftsQuery = this.hasFts() ? toFtsQuery(text) : null
      if (ftsQuery) {
        conditions.push(
          sql`${dictionary.id} in (select rowid from dictionary_fts where dictionary_fts match ${ftsQuery})`
        )
      } else {
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
    }

    if (conditions.length === 0) return undefined
    if (conditions.length === 1) return conditions[0]
    return and(...conditions) as SQL
  }

  private hasFts(): boolean {
    if (this.ftsEnabled != null) return this.ftsEnabled
    try {
      const sqlite = (this.db as { $client: { prepare: (sql: string) => { get: () => unknown } } })
        .$client
      const table = sqlite
        .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'dictionary_fts'")
        .get()
      if (!table) {
        this.ftsEnabled = false
        return false
      }
      this.ftsEnabled = Boolean(
        sqlite.prepare("SELECT 1 FROM dictionary_fts WHERE dictionary_fts MATCH 'a*' LIMIT 1").get()
      )
    } catch {
      this.ftsEnabled = false
    }
    return this.ftsEnabled
  }

  private findUnscopedByText(
    sourceLang: string,
    targetLang: string,
    sourceText: string
  ): DictionaryEntry | undefined {
    const [l1, l2, swapped] = normalizeLangs(sourceLang, targetLang)
    const sourceKey = dictionaryTextKey(sourceText)
    const keyColumn = swapped ? dictionary.textLanguage2Key : dictionary.textLanguage1Key

    return this.db
      .select()
      .from(dictionary)
      .where(
        and(
          eq(dictionary.language1, l1),
          eq(dictionary.language2, l2),
          sql`${dictionary.modName} is null`,
          eq(keyColumn, sourceKey)
        )
      )
      .orderBy(desc(dictionary.updatedAt), desc(dictionary.id))
      .get() as DictionaryEntry | undefined
  }

  private findUnscopedByUidAndText(
    sourceLang: string,
    targetLang: string,
    uid: string,
    sourceText: string
  ): DictionaryEntry | undefined {
    const [l1, l2, swapped] = normalizeLangs(sourceLang, targetLang)
    const sourceKey = dictionaryTextKey(sourceText)
    const keyColumn = swapped ? dictionary.textLanguage2Key : dictionary.textLanguage1Key

    return this.db
      .select()
      .from(dictionary)
      .where(
        and(
          eq(dictionary.language1, l1),
          eq(dictionary.language2, l2),
          sql`${dictionary.modName} is null`,
          eq(dictionary.uid, uid),
          eq(keyColumn, sourceKey)
        )
      )
      .orderBy(desc(dictionary.updatedAt), desc(dictionary.id))
      .get() as DictionaryEntry | undefined
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
      textLanguage1Key: dictionaryTextKey(text1),
      textLanguage2Key: dictionaryTextKey(text2),
      modName: params.modName?.trim() || null,
      uid: params.uid?.trim() || null
    }
  }
}
