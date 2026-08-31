import path from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import type { MergeProgress, MergeResult } from '../../preload/api-types'
import { DictionaryRepository } from '../database/repositories/dictionary.repo'
import { SourceFileRepository } from '../database/repositories/source-file.repo'
import type { NewDictionaryEntry } from '../database/schema'
import * as schema from '../database/schema'
import { applySqlitePragmas } from '../database/sqlite-pragmas'
import {
  type LocalizationEntry,
  parseLocalizationFile
} from '../services/xml-parser.service'
import { dictionaryTextKey, normalizeDictionaryText } from '../utils/dictionaryText'
import { normalizeLangs } from '../utils/languages'

export type { MergeProgress, MergeResult }

export interface MergeWorkerInput {
  sourceXmlPath: string
  sourceLang: string
  targetXmlPath: string
  targetLang: string
  modName: string
  dbPath: string
}

interface PendingUpdate {
  id: number
  targetText: string
  targetTextKey: string
  uid: string | null
}

const WRITE_CHUNK = 500

export async function runMergeWorker(
  input: MergeWorkerInput,
  post: (msg: MergeProgress) => void
): Promise<void> {
  const sqlite = new Database(input.dbPath)
  applySqlitePragmas(sqlite)

  try {
    const db = drizzle(sqlite, { schema })
    const repo = new DictionaryRepository(db)

    post({ phase: 'parsing' })
    const sourceEntries = parseLocalizationFile(input.sourceXmlPath)
    const targetEntries = parseLocalizationFile(input.targetXmlPath)
    const targetBuckets = groupByUid(targetEntries)

    post({ phase: 'loading-map' })
    const keyMap = repo.loadKeyMap(input.sourceLang, input.targetLang, input.modName)

    // mod FK row - INSERT OR IGNORE so dictionary writes never violate the FK.
    sqlite
      .prepare('INSERT INTO mod (name) VALUES (?) ON CONFLICT(name) DO NOTHING')
      .run(input.modName)

    // Per-file identity for the target (translated) side - the target file name is
    // what exports will rebuild. Source file name only fills in when the target is
    // the merged file (import flow already registered real names).
    const sourceRepo = new SourceFileRepository(db)
    const targetFileName = path.basename(input.targetXmlPath)
    const targetIsLoca = targetFileName.toLowerCase().endsWith('.loca')
    const targetFileId = sourceRepo.getOrCreate(
      input.modName,
      targetFileName,
      targetIsLoca ? 'loca' : 'xml'
    )

    post({ phase: 'classifying' })
    const [l1, l2, swapped] = normalizeLangs(input.sourceLang, input.targetLang)
    const updateColumn: 'language1' | 'language2' = swapped ? 'language1' : 'language2'

    const inserts: NewDictionaryEntry[] = []
    const updates: (PendingUpdate & { sourceFileId: number })[] = []
    let matched = 0

    for (const sourceEntry of sourceEntries) {
      const targetEntry = targetBuckets.get(sourceEntry.contentuid)?.shift()
      if (!targetEntry) continue

      const sourceText = normalizeDictionaryText(sourceEntry.text)
      const targetText = normalizeDictionaryText(targetEntry.text)
      if (!sourceText || !targetText) continue

      matched++

      const sourceKey = dictionaryTextKey(sourceText)
      const targetKey = dictionaryTextKey(targetText)
      const existing = keyMap.get(sourceKey)

      if (existing) {
        // skip-if-equal: nothing changed for this row (file pointer stays too).
        if (existing.targetKey === targetKey && existing.sourceFileId === targetFileId) continue
        updates.push({
          id: existing.id,
          targetText,
          targetTextKey: targetKey,
          uid: sourceEntry.contentuid,
          sourceFileId: targetFileId
        })
      } else {
        const [text1, text2] = swapped ? [targetText, sourceText] : [sourceText, targetText]
        inserts.push({
          language1: l1,
          language2: l2,
          textLanguage1: text1,
          textLanguage2: text2,
          textLanguage1Key: dictionaryTextKey(text1),
          textLanguage2Key: dictionaryTextKey(text2),
          modName: input.modName,
          uid: sourceEntry.contentuid,
          sourceFileId: targetFileId
        })
      }
    }

    const total = inserts.length + updates.length
    let processed = 0
    post({ phase: 'writing', processed, total })

    for (let i = 0; i < inserts.length; i += WRITE_CHUNK) {
      const chunk = inserts.slice(i, i + WRITE_CHUNK)
      repo.bulkInsert(chunk)
      processed += chunk.length
      post({ phase: 'writing', processed, total })
      await new Promise<void>((resolve) => setImmediate(resolve))
    }

    for (let i = 0; i < updates.length; i += WRITE_CHUNK) {
      const chunk = updates.slice(i, i + WRITE_CHUNK)
      repo.bulkUpdate(chunk, updateColumn)
      processed += chunk.length
      post({ phase: 'writing', processed, total })
      await new Promise<void>((resolve) => setImmediate(resolve))
    }

    if (matched > 0) {
      sqlite.prepare('UPDATE mod SET total_strings = ? WHERE name = ?').run(matched, input.modName)
    }

    const sourceOnly = countMissingOccurrences(sourceEntries, targetEntries)
    const targetOnly = countMissingOccurrences(targetEntries, sourceEntries)

    post({ phase: 'done', result: { matched, sourceOnly, targetOnly } })
  } finally {
    sqlite.close()
  }
}

function groupByUid(entries: LocalizationEntry[]): Map<string, LocalizationEntry[]> {
  const buckets = new Map<string, LocalizationEntry[]>()
  for (const entry of entries) {
    const bucket = buckets.get(entry.contentuid) ?? []
    bucket.push(entry)
    buckets.set(entry.contentuid, bucket)
  }
  return buckets
}

function countMissingOccurrences(a: LocalizationEntry[], b: LocalizationEntry[]): number {
  const aCounts = countUids(a)
  const bCounts = countUids(b)
  let count = 0
  for (const [uid, total] of aCounts) count += Math.max(0, total - (bCounts.get(uid) ?? 0))
  return count
}

function countUids(entries: LocalizationEntry[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const entry of entries) counts.set(entry.contentuid, (counts.get(entry.contentuid) ?? 0) + 1)
  return counts
}
