import fs from 'node:fs/promises'
import path from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import type { DictionaryFilters } from '../database/repositories/dictionary.repo'
import { DictionaryRepository } from '../database/repositories/dictionary.repo'
import { ModRepository } from '../database/repositories/mod.repo'
import * as schema from '../database/schema'
import { applySqlitePragmas } from '../database/sqlite-pragmas'

export const DELETE_CHUNK = 200

export type DeleteJob =
  | { type: 'mods'; modNames: string[] }
  | { type: 'dictionary-ids'; ids: number[] }
  | { type: 'dictionary-filter'; filters: DictionaryFilters }

export interface DeleteWorkerInput {
  dbPath: string
  modsRoot?: string
  job: DeleteJob
  chunkSize?: number
}

export interface DeleteModItemResult {
  modName: string
  dictionaryRows: number
  hadMeta: boolean
  folderRemoved: boolean
  folderPath: string
}

export interface DeleteWorkerResult {
  dictionaryRows: number
  mods?: DeleteModItemResult[]
}

export type DeleteProgress =
  | { phase: 'counting'; total: number }
  | { phase: 'deleting'; processed: number; total: number }
  | { phase: 'folders' }
  | { phase: 'done'; result: DeleteWorkerResult }
  | { phase: 'error'; message: string }

function yieldTick(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

function sanitizeStoredModName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
}

function uniqueModNames(names: string[]): string[] {
  const seen = new Set<string>()
  const unique: string[] = []
  for (const raw of names) {
    const name = raw.trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    unique.push(name)
  }
  return unique
}

export async function runDeleteWorker(
  input: DeleteWorkerInput,
  post: (msg: DeleteProgress) => void
): Promise<void> {
  const sqlite = new Database(input.dbPath)
  applySqlitePragmas(sqlite)
  sqlite.pragma('busy_timeout = 30000')

  try {
    const db = drizzle(sqlite, { schema })
    const dictRepo = new DictionaryRepository(db)
    const modRepo = new ModRepository(db)
    const chunkSize = Math.max(1, input.chunkSize ?? DELETE_CHUNK)

    if (input.job.type === 'mods') {
      const result = await deleteMods(
        dictRepo,
        modRepo,
        input.job.modNames,
        input.modsRoot,
        chunkSize,
        post
      )
      post({ phase: 'done', result })
      return
    }

    if (input.job.type === 'dictionary-ids') {
      const deleted = await deleteByIds(dictRepo, input.job.ids, chunkSize, post)
      post({ phase: 'done', result: { dictionaryRows: deleted } })
      return
    }

    const deleted = await deleteByFilter(dictRepo, input.job.filters, chunkSize, post)
    post({ phase: 'done', result: { dictionaryRows: deleted } })
  } finally {
    sqlite.close()
  }
}

async function deleteByIds(
  dictRepo: DictionaryRepository,
  ids: number[],
  chunkSize: number,
  post: (msg: DeleteProgress) => void
): Promise<number> {
  const uniqueIds = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))]
  const total = uniqueIds.length
  post({ phase: 'counting', total })
  if (total === 0) return 0

  let processed = 0
  for (let i = 0; i < uniqueIds.length; i += chunkSize) {
    const slice = uniqueIds.slice(i, i + chunkSize)
    processed += dictRepo.deleteByIds(slice)
    post({ phase: 'deleting', processed, total })
    await yieldTick()
  }
  return processed
}

async function deleteByFilter(
  dictRepo: DictionaryRepository,
  filters: DictionaryFilters,
  chunkSize: number,
  post: (msg: DeleteProgress) => void
): Promise<number> {
  const total = dictRepo.countByFilter(filters)
  post({ phase: 'counting', total })
  if (total === 0) return 0

  let processed = 0
  while (processed < total) {
    const chunk = dictRepo.deleteChunkByFilter(filters, chunkSize)
    if (chunk === 0) break
    processed += chunk
    post({ phase: 'deleting', processed, total })
    await yieldTick()
  }
  return processed
}

async function deleteMods(
  dictRepo: DictionaryRepository,
  modRepo: ModRepository,
  modNames: string[],
  modsRoot: string | undefined,
  chunkSize: number,
  post: (msg: DeleteProgress) => void
): Promise<DeleteWorkerResult> {
  const names = uniqueModNames(modNames)
  const counts = dictRepo.countAllByModNames(names)
  const total = names.reduce((sum, name) => sum + (counts[name] ?? 0), 0)
  post({ phase: 'counting', total })

  let processed = 0
  const mods: DeleteModItemResult[] = []

  for (const modName of names) {
    const folderPath = modsRoot ? path.join(modsRoot, sanitizeStoredModName(modName)) : ''
    const expectedRows = counts[modName] ?? 0

    while (true) {
      const chunk = dictRepo.deleteChunkByModName(modName, chunkSize)
      if (chunk === 0) break
      processed += chunk
      post({ phase: 'deleting', processed, total: Math.max(total, processed) })
      await yieldTick()
    }

    const { dictionaryRows: leftover, hadMeta } = modRepo.delete(modName)
    processed += leftover

    let folderRemoved = false
    if (modsRoot && folderPath) {
      post({ phase: 'folders' })
      folderRemoved = await removeModFolder(folderPath)
    }

    mods.push({
      modName,
      dictionaryRows: expectedRows + leftover,
      hadMeta,
      folderRemoved,
      folderPath
    })
  }

  return { dictionaryRows: processed, mods }
}

async function removeModFolder(folderPath: string): Promise<boolean> {
  try {
    await fs.access(folderPath)
    await fs.rm(folderPath, { recursive: true })
    return true
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return false
    return false
  }
}
