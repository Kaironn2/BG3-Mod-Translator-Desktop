import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import type { DictionaryFilters } from '../database/repositories/dictionary.repo'
import { DictionaryRepository } from '../database/repositories/dictionary.repo'
import * as schema from '../database/schema'
import { applySqlitePragmas } from '../database/sqlite-pragmas'
import {
  applyDictionaryReplacePatch,
  type DictionaryReplacePatch
} from '../utils/dictionary-replace'

export const REPLACE_CHUNK = 200

export type ReplaceJob =
  | {
      type: 'dictionary-ids'
      ids: number[]
      filters: DictionaryFilters
      patch: DictionaryReplacePatch
    }
  | { type: 'dictionary-filter'; filters: DictionaryFilters; patch: DictionaryReplacePatch }

export interface ReplaceWorkerInput {
  dbPath: string
  job: ReplaceJob
  chunkSize?: number
}

export interface ReplaceWorkerResult {
  updated: number
}

export type ReplaceProgress =
  | { phase: 'counting'; total: number }
  | { phase: 'replacing'; processed: number; total: number }
  | { phase: 'done'; result: ReplaceWorkerResult }
  | { phase: 'error'; message: string }

function yieldTick(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

export async function runReplaceWorker(
  input: ReplaceWorkerInput,
  post: (msg: ReplaceProgress) => void
): Promise<void> {
  const sqlite = new Database(input.dbPath)
  applySqlitePragmas(sqlite)
  sqlite.pragma('busy_timeout = 30000')

  try {
    const db = drizzle(sqlite, { schema })
    const dictRepo = new DictionaryRepository(db)
    const chunkSize = Math.max(1, input.chunkSize ?? REPLACE_CHUNK)

    if (input.job.type === 'dictionary-ids') {
      const updated = await replaceByIds(
        dictRepo,
        input.job.ids,
        input.job.filters,
        input.job.patch,
        chunkSize,
        post
      )
      post({ phase: 'done', result: { updated } })
      return
    }

    const updated = await replaceByFilter(
      dictRepo,
      input.job.filters,
      input.job.patch,
      chunkSize,
      post
    )
    post({ phase: 'done', result: { updated } })
  } finally {
    sqlite.close()
  }
}

async function replaceByIds(
  dictRepo: DictionaryRepository,
  ids: number[],
  filters: DictionaryFilters,
  patch: DictionaryReplacePatch,
  chunkSize: number,
  post: (msg: ReplaceProgress) => void
): Promise<number> {
  const uniqueIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))]
  const total = uniqueIds.length
  post({ phase: 'counting', total })
  if (total === 0) return 0

  let processed = 0
  let updated = 0
  for (let i = 0; i < uniqueIds.length; i += chunkSize) {
    const slice = uniqueIds.slice(i, i + chunkSize)
    const rows = dictRepo.listByIds(slice)
    updated += applyAndWrite(dictRepo, rows, filters, patch)
    processed += slice.length
    post({ phase: 'replacing', processed, total })
    await yieldTick()
  }
  return updated
}

async function replaceByFilter(
  dictRepo: DictionaryRepository,
  filters: DictionaryFilters,
  patch: DictionaryReplacePatch,
  chunkSize: number,
  post: (msg: ReplaceProgress) => void
): Promise<number> {
  const total = dictRepo.countByFilter(filters)
  post({ phase: 'counting', total })
  if (total === 0) return 0

  let processed = 0
  let updated = 0
  let afterId = 0
  while (processed < total) {
    const chunk = dictRepo.listChunkByFilter(filters, afterId, chunkSize)
    if (chunk.length === 0) break
    afterId = chunk[chunk.length - 1].id
    updated += applyAndWrite(dictRepo, chunk, filters, patch)
    processed += chunk.length
    post({ phase: 'replacing', processed, total })
    await yieldTick()
  }
  return updated
}

function applyAndWrite(
  dictRepo: DictionaryRepository,
  rows: Array<{
    id: number
    language1: string
    language2: string
    textLanguage1: string
    textLanguage2: string
  }>,
  filters: DictionaryFilters,
  patch: DictionaryReplacePatch
): number {
  const changes: Array<{ id: number; textLanguage1: string; textLanguage2: string }> = []
  for (const row of rows) {
    const next = applyDictionaryReplacePatch(row, filters, patch)
    if (next) changes.push(next)
  }
  if (changes.length > 0) dictRepo.updateReplacedTexts(changes)
  return changes.length
}
