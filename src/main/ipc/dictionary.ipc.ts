import { ipcMain } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { RepositoryRegistry } from '../database/repositories/registry'
import { findSimilar } from '../services/similarity.service'
import { csvCell, parseCsv, parseCsvTable } from '../utils/csv'

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

interface DictionaryImportRow {
  sourceLang: string
  targetLang: string
  sourceText: string
  targetText: string
  modName: string | null
  uid: string | null
}

const HEADER_ALIASES = {
  sourceLang: ['language1', 'src_lang'],
  targetLang: ['language2', 'tgt_lang'],
  sourceText: ['text_language1', 'src'],
  targetText: ['text_language2', 'tgt'],
  modName: ['mod_name', 'mod'],
  uid: ['uid']
} as const

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

  ipcMain.handle('dictionary:getAll', (_event, { lang1, lang2 }: { lang1: string; lang2: string }) =>
    repos.dictionary.list({ sourceLang: lang1, targetLang: lang2 })
  )

  ipcMain.handle('dictionary:search', (_event, { text, lang1, lang2 }: { text: string; lang1: string; lang2: string }) =>
    repos.dictionary.list({ text, sourceLang: lang1, targetLang: lang2 })
  )

  ipcMain.handle('dictionary:create', (_event, entry: DictionaryMutationPayload) => {
    persistMod(repos, entry.modName)
    repos.dictionary.create(toRepoPayload(entry))
    return { success: true }
  })

  ipcMain.handle(
    'dictionary:update',
    (_event, { id, entry }: { id: number; entry: DictionaryMutationPayload }) => {
      persistMod(repos, entry.modName)
      repos.dictionary.update(id, toRepoPayload(entry))
      return { success: true }
    }
  )

  ipcMain.handle('dictionary:upsert', (_event, entry: DictionaryMutationPayload) => {
    persistMod(repos, entry.modName)
    repos.dictionary.upsert(toRepoPayload(entry))
    return { success: true }
  })

  ipcMain.handle('dictionary:delete', (_event, { id }: { id: number }) => {
    repos.dictionary.delete(id)
    return { success: true }
  })

  ipcMain.handle(
    'dictionary:similar',
    (
      _event,
      { text, lang1, lang2, limit }: { text: string; lang1: string; lang2: string; limit?: number }
    ) => {
      const corpus = repos.dictionary.getAllForSimilarity(lang1, lang2)
      return findSimilar(text, corpus, limit ?? 5)
    }
  )

  ipcMain.handle(
    'dictionary:previewImport',
    (_event, { filePath, format }: { filePath: string; format: 'csv' | 'xlsx' }) => {
      if (format === 'xlsx') throw new Error('XLSX import not yet supported')
      const preview = readImportFile(filePath)
      return {
        headers: preview.headers,
        totalRows: preview.rows.length,
        rows: preview.rows.slice(0, 5)
      }
    }
  )

  ipcMain.handle(
    'dictionary:import',
    (_event, { filePath, format }: { filePath: string; format: 'csv' | 'xlsx' }) => {
      if (format === 'xlsx') throw new Error('XLSX import not yet supported')
      const preview = readImportFile(filePath)
      let count = 0

      for (const row of preview.rows) {
        if (!row.sourceLang || !row.targetLang || !row.sourceText || !row.targetText) continue
        persistMod(repos, row.modName)
        repos.dictionary.upsert({
          sourceLang: row.sourceLang,
          targetLang: row.targetLang,
          sourceText: row.sourceText,
          targetText: row.targetText,
          modName: row.modName,
          uid: row.uid
        })
        count++
      }

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

function readImportFile(filePath: string): {
  headers: string[]
  rows: DictionaryImportRow[]
} {
  const content = fs.readFileSync(filePath, 'utf-8')
  const rawRows = parseCsv(content)
  const { headers } = parseCsvTable(content)

  return {
    headers,
    rows: rawRows.map(normalizeImportRow)
  }
}

function normalizeImportRow(row: Record<string, string>): DictionaryImportRow {
  return {
    sourceLang: readColumn(row, HEADER_ALIASES.sourceLang),
    targetLang: readColumn(row, HEADER_ALIASES.targetLang),
    sourceText: readColumn(row, HEADER_ALIASES.sourceText),
    targetText: readColumn(row, HEADER_ALIASES.targetText),
    modName: readColumn(row, HEADER_ALIASES.modName) || null,
    uid: readColumn(row, HEADER_ALIASES.uid) || null
  }
}

function readColumn(
  row: Record<string, string>,
  aliases: readonly string[]
): string {
  for (const alias of aliases) {
    if (alias in row) return row[alias]?.trim() ?? ''
  }
  return ''
}
