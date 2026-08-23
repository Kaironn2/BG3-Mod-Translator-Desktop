import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { DictionaryRepository } from '../database/repositories/dictionary.repo'
import { ModRepository } from '../database/repositories/mod.repo'
import type { NewDictionaryEntry } from '../database/schema'
import * as schema from '../database/schema'
import { applySqlitePragmas } from '../database/sqlite-pragmas'
import { readImportCsv } from '../utils/dictionaryCsv'
import { dictionaryTextKey, normalizeDictionaryText } from '../utils/dictionaryText'
import { normalizeLangs } from '../utils/languages'

export interface ImportWorkerInput {
  filePath: string
  dbPath: string
}

export type ImportProgress =
  | { phase: 'reading' }
  | { phase: 'parsing' }
  | { phase: 'writing'; processed: number; total: number }
  | { phase: 'done'; count: number }
  | { phase: 'error'; message: string }

interface PendingInsert extends NewDictionaryEntry {}
interface PendingUpdate {
  id: number
  targetText: string
  targetTextKey: string
  uid: string | null
}

const WRITE_CHUNK = 500

export async function runImportWorker(
  input: ImportWorkerInput,
  post: (msg: ImportProgress) => void
): Promise<void> {
  const sqlite = new Database(input.dbPath)
  applySqlitePragmas(sqlite)

  try {
    const db = drizzle(sqlite, { schema })
    const dictRepo = new DictionaryRepository(db)
    const modRepo = new ModRepository(db)

    post({ phase: 'reading' })
    const { rows: csvRows } = readImportCsv(input.filePath)

    post({ phase: 'parsing' })
    const valid = csvRows.filter(
      (r) => r.sourceLang && r.targetLang && r.sourceText && r.targetText
    )

    // Group rows by (sourceLang, targetLang, modName) to use loadKeyMap per group
    const groups = new Map<
      string,
      { sourceLang: string; targetLang: string; modName: string | null; rows: typeof valid }
    >()
    for (const row of valid) {
      const key = `${row.sourceLang}|${row.targetLang}|${row.modName ?? ''}`
      if (!groups.has(key)) {
        groups.set(key, {
          sourceLang: row.sourceLang,
          targetLang: row.targetLang,
          modName: row.modName,
          rows: []
        })
      }
      groups.get(key)!.rows.push(row)
    }

    const total = valid.length
    let processed = 0

    for (const group of groups.values()) {
      const { sourceLang, targetLang, modName, rows } = group
      const trimmedModName = modName?.trim() || null

      // Ensure mod FK row exists
      if (trimmedModName) modRepo.upsert(trimmedModName)

      const [, , swapped] = normalizeLangs(sourceLang, targetLang)
      const targetColumn: 'language1' | 'language2' = swapped ? 'language1' : 'language2'

      const toInsert: PendingInsert[] = []
      const toUpdate: PendingUpdate[] = []

      if (trimmedModName) {
        const keyMap = dictRepo.loadKeyMap(sourceLang, targetLang, trimmedModName)

        for (const row of rows) {
          const sourceText = normalizeDictionaryText(row.sourceText)
          const targetText = normalizeDictionaryText(row.targetText)
          if (!sourceText || !targetText) continue
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
            toInsert.push(
              buildEntry(
                sourceLang,
                targetLang,
                swapped,
                sourceText,
                targetText,
                trimmedModName,
                row.uid
              )
            )
          }
        }
      } else {
        // Null modName - build inserts only (no mod-scoped key map available)
        for (const row of rows) {
          const sourceText = normalizeDictionaryText(row.sourceText)
          const targetText = normalizeDictionaryText(row.targetText)
          if (!sourceText || !targetText) continue
          toInsert.push(
            buildEntry(sourceLang, targetLang, swapped, sourceText, targetText, null, row.uid)
          )
        }
      }

      // Chunked inserts with progress + event-loop yield
      for (let i = 0; i < toInsert.length; i += WRITE_CHUNK) {
        const slice = toInsert.slice(i, i + WRITE_CHUNK)
        dictRepo.bulkInsert(slice)
        processed += slice.length
        post({ phase: 'writing', processed, total })
        await new Promise<void>((resolve) => setImmediate(resolve))
      }

      // Chunked updates with progress + event-loop yield
      for (let i = 0; i < toUpdate.length; i += WRITE_CHUNK) {
        const slice = toUpdate.slice(i, i + WRITE_CHUNK)
        dictRepo.bulkUpdate(slice, targetColumn)
        processed += slice.length
        post({ phase: 'writing', processed, total })
        await new Promise<void>((resolve) => setImmediate(resolve))
      }
    }

    post({ phase: 'done', count: processed })
  } finally {
    sqlite.close()
  }
}

// Mirrors DictionaryRepository.toValues — must stay in sync with normalizeLangs invariant.
function buildEntry(
  sourceLang: string,
  targetLang: string,
  swapped: boolean,
  sourceText: string,
  targetText: string,
  modName: string | null,
  uid: string | null | undefined
): NewDictionaryEntry {
  // swapped=true means sourceLang > targetLang alphabetically, so l1=targetLang, l2=sourceLang
  const l1 = swapped ? targetLang : sourceLang
  const l2 = swapped ? sourceLang : targetLang
  const [text1, text2] = swapped ? [targetText, sourceText] : [sourceText, targetText]
  return {
    language1: l1,
    language2: l2,
    textLanguage1: text1,
    textLanguage2: text2,
    textLanguage1Key: dictionaryTextKey(text1),
    textLanguage2Key: dictionaryTextKey(text2),
    modName: modName || null,
    uid: uid?.trim() || null
  }
}
