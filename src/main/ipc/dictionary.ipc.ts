import fs from 'node:fs'
import path from 'node:path'
import { ipcMain } from 'electron'
import { getDbPath } from '../database/connection'
import type { RepositoryRegistry } from '../database/repositories/registry'
import { runImport } from '../services/import.service'
import { getSimilarityClient, invalidateSimilarityCache } from '../services/similarity-client'
import { csvCell } from '../utils/csv'
import { readImportCsv } from '../utils/dictionaryCsv'

interface DictionaryFilters {
  text?: string
  modName?: string
  sourceLang?: string
  targetLang?: string
}

interface DictionaryListPayload {
  filters: DictionaryFilters
  page: number
  pageSize: number
}

interface DictionaryMutationPayload {
  language1: string
  language2: string
  textLanguage1: string
  textLanguage2: string
  modName?: string | null
  uid?: string | null
}

export function registerDictionaryHandlers(repos: RepositoryRegistry): void {
  ipcMain.handle('dictionary:list', (_event, payload: DictionaryListPayload) => {
    const requestedPage = Math.max(1, payload.page || 1)
    const pageSize = Math.max(1, payload.pageSize || 1)
    const firstPass = repos.dictionary.listPaginated(payload.filters ?? {}, requestedPage, pageSize)
    const totalPages = Math.max(1, Math.ceil(firstPass.total / pageSize))
    const page = Math.min(requestedPage, totalPages)
    const result =
      page === requestedPage
        ? firstPass
        : repos.dictionary.listPaginated(payload.filters ?? {}, page, pageSize)

    return {
      items: result.items,
      total: result.total,
      page,
      pageSize,
      totalPages
    }
  })

  ipcMain.handle(
    'dictionary:getAll',
    (_event, { lang1, lang2 }: { lang1: string; lang2: string }) =>
      repos.dictionary.list({ sourceLang: lang1, targetLang: lang2 })
  )

  ipcMain.handle(
    'dictionary:search',
    (_event, { text, lang1, lang2 }: { text: string; lang1: string; lang2: string }) =>
      repos.dictionary.list({ text, sourceLang: lang1, targetLang: lang2 })
  )

  ipcMain.handle('dictionary:create', (_event, entry: DictionaryMutationPayload) => {
    persistMod(repos, entry.modName)
    repos.dictionary.create(toRepoPayload(entry))
    invalidateSimilarity()
    return { success: true }
  })

  ipcMain.handle(
    'dictionary:update',
    (_event, { id, entry }: { id: number; entry: DictionaryMutationPayload }) => {
      persistMod(repos, entry.modName)
      repos.dictionary.update(id, toRepoPayload(entry))
      invalidateSimilarity()
      return { success: true }
    }
  )

  ipcMain.handle('dictionary:upsert', (_event, entry: DictionaryMutationPayload) => {
    persistMod(repos, entry.modName)
    repos.dictionary.upsert(toRepoPayload(entry))
    invalidateSimilarity()
    return { success: true }
  })

  ipcMain.handle('dictionary:bulkUpsert', (_event, entries: DictionaryMutationPayload[]) => {
    if (entries.length === 0) return { count: 0 }
    persistMod(repos, entries[0].modName)
    repos.dictionary.bulkUpsert(entries.map(toRepoPayload))
    invalidateSimilarity()
    return { count: entries.length }
  })

  ipcMain.handle('dictionary:delete', (_event, { id }: { id: number }) => {
    repos.dictionary.delete(id)
    invalidateSimilarity()
    return { success: true }
  })

  ipcMain.handle('dictionary:deleteByFilter', (_event, filters: DictionaryFilters) => {
    const result = repos.dictionary.deleteByFilter(filters)
    invalidateSimilarity()
    return result
  })

  ipcMain.handle(
    'dictionary:replaceByFilter',
    (
      _event,
      {
        filters,
        patch
      }: {
        filters: DictionaryFilters
        patch: { findText: string; replaceText: string; column: 'language1' | 'language2' }
      }
    ) => {
      const result = repos.dictionary.updateTextByFilter(filters, patch)
      invalidateSimilarity()
      return result
    }
  )

  ipcMain.handle(
    'dictionary:similar',
    (
      _event,
      { text, lang1, lang2, limit }: { text: string; lang1: string; lang2: string; limit?: number }
    ) =>
      getSimilarityClient(getDbPath()).search({
        text,
        sourceLang: lang1,
        targetLang: lang2,
        limit: limit ?? 5
      })
  )

  ipcMain.handle(
    'dictionary:previewImport',
    (_event, { filePath, format }: { filePath: string; format: 'csv' | 'xlsx' }) => {
      if (format === 'xlsx') throw new Error('XLSX import not yet supported')
      const preview = readImportCsv(filePath)
      return {
        headers: preview.headers,
        totalRows: preview.rows.length,
        rows: preview.rows.slice(0, 5)
      }
    }
  )

  ipcMain.handle(
    'dictionary:import',
    async (event, { filePath, format }: { filePath: string; format: 'csv' | 'xlsx' }) => {
      if (format === 'xlsx') throw new Error('XLSX import not yet supported')
      const count = await runImport({
        filePath,
        onProgress: (p) => event.sender.send('dictionary:import:progress', p)
      })
      invalidateSimilarity()
      return { count }
    }
  )

  ipcMain.handle(
    'dictionary:export',
    (
      _event,
      {
        filters,
        format,
        outputPath
      }: {
        filters: DictionaryFilters
        format: 'csv' | 'xlsx'
        outputPath: string
      }
    ) => {
      if (format === 'xlsx') throw new Error('XLSX export not yet supported')
      const entries = repos.dictionary.list(filters)
      const header = 'id,language1,language2,text_language1,text_language2,mod_name,uid'
      const lines = entries.map((entry) =>
        [
          entry.id,
          entry.language1,
          entry.language2,
          csvCell(entry.textLanguage1),
          csvCell(entry.textLanguage2),
          csvCell(entry.modName ?? ''),
          csvCell(entry.uid ?? '')
        ].join(',')
      )

      fs.mkdirSync(path.dirname(outputPath), { recursive: true })
      fs.writeFileSync(outputPath, [header, ...lines].join('\n'), 'utf-8')
      return { success: true }
    }
  )
}

function toRepoPayload(entry: DictionaryMutationPayload) {
  return {
    sourceLang: entry.language1,
    targetLang: entry.language2,
    sourceText: entry.textLanguage1,
    targetText: entry.textLanguage2,
    modName: entry.modName ?? null,
    uid: entry.uid ?? null
  }
}

function persistMod(repos: RepositoryRegistry, modName?: string | null): void {
  if (modName?.trim()) repos.mod.upsert(modName.trim())
}

function invalidateSimilarity(): void {
  invalidateSimilarityCache()
}
