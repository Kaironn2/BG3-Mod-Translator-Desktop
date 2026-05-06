import { eq, and, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { dictionary, type DictionaryEntry, type NewDictionaryEntry } from '../schema'

type AppDb = ReturnType<typeof drizzle>

export interface SimilarityRow {
  source: string
  target: string
}

export interface UpsertParams {
  sourceLang: string
  targetLang: string
  sourceText: string
  targetText: string
  modName?: string
  uid?: string
}

// Invariant: language1 < language2 always - prevents mirrored duplicates
function normalizeLangs(a: string, b: string): [string, string, swapped: boolean] {
  const swapped = a > b
  return swapped ? [b, a, true] : [a, b, false]
}

export class DictionaryRepository {
  constructor(private db: AppDb) {}

  findByUid(uid: string, sourceLang: string, targetLang: string): DictionaryEntry | undefined {
    const [l1, l2] = normalizeLangs(sourceLang, targetLang)
    return this.db
      .select()
      .from(dictionary)
      .where(
        and(eq(dictionary.language1, l1), eq(dictionary.language2, l2), eq(dictionary.uid, uid))
      )
      .get() as DictionaryEntry | undefined
  }

  findByText(
    sourceLang: string,
    targetLang: string,
    sourceText: string
  ): DictionaryEntry | undefined {
    const [l1, l2, swapped] = normalizeLangs(sourceLang, targetLang)
    const col = swapped ? dictionary.textLanguage2 : dictionary.textLanguage1
    return this.db
      .select()
      .from(dictionary)
      .where(and(eq(dictionary.language1, l1), eq(dictionary.language2, l2), eq(col, sourceText)))
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
    return this.db
      .select()
      .from(dictionary)
      .where(
        and(
          eq(dictionary.language1, l1),
          eq(dictionary.language2, l2),
          eq(dictionary.modName, modName),
          eq(col, sourceText)
        )
      )
      .get() as DictionaryEntry | undefined
  }

  upsert(params: UpsertParams): void {
    const [l1, l2, swapped] = normalizeLangs(params.sourceLang, params.targetLang)
    const [text1, text2] = swapped
      ? [params.targetText, params.sourceText]
      : [params.sourceText, params.targetText]

    const values: NewDictionaryEntry = {
      language1: l1,
      language2: l2,
      textLanguage1: text1,
      textLanguage2: text2,
      modName: params.modName ?? null,
      uid: params.uid ?? null
    }

    this.db
      .insert(dictionary)
      .values(values)
      .onConflictDoUpdate({
        target: [dictionary.language1, dictionary.language2, dictionary.uid],
        set: {
          textLanguage1: sql`excluded.text_language1`,
          textLanguage2: sql`excluded.text_language2`,
          modName: sql`excluded.mod_name`,
          updatedAt: sql`(datetime('now'))`
        }
      })
      .run()
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

    return rows.map((r) => ({
      source: swapped ? r.t2 : r.t1,
      target: swapped ? r.t1 : r.t2
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
}
