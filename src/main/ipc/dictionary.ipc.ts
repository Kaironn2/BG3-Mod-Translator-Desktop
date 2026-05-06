import { ipcMain } from 'electron'
import { and, eq, like, or } from 'drizzle-orm'
import fs from 'fs'
import path from 'path'
import { dictionary } from '../database/schema'
import type { RepositoryRegistry } from '../database/repositories/registry'
import { findSimilar } from '../services/similarity.service'
import { csvCell, parseCsv } from '../utils/csv'
import { normalizeLangs } from '../utils/languages'

export function registerDictionaryHandlers(repos: RepositoryRegistry): void {
  ipcMain.handle(
    'dictionary:getAll',
    (_event, { lang1, lang2 }: { lang1: string; lang2: string }) => {
      return repos.dictionary.getAll(lang1, lang2)
    }
  )

  ipcMain.handle(
    'dictionary:search',
    (_event, { text, lang1, lang2 }: { text: string; lang1: string; lang2: string }) => {
      const [l1, l2] = normalizeLangs(lang1, lang2)
      const pattern = `%${text}%`
      return repos.db
        .select()
        .from(dictionary)
        .where(
          and(
            eq(dictionary.language1, l1),
            eq(dictionary.language2, l2),
            or(like(dictionary.textLanguage1, pattern), like(dictionary.textLanguage2, pattern))
          )
        )
        .all()
    }
  )

  ipcMain.handle(
    'dictionary:upsert',
    (
      _event,
      entry: {
        language1: string
        language2: string
        textLanguage1: string
        textLanguage2: string
        modName?: string | null
        uid?: string | null
      }
    ) => {
      repos.dictionary.upsert({
        sourceLang: entry.language1,
        targetLang: entry.language2,
        sourceText: entry.textLanguage1,
        targetText: entry.textLanguage2,
        modName: entry.modName ?? undefined,
        uid: entry.uid ?? undefined
      })
      return { success: true }
    }
  )

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
    'dictionary:import',
    (_event, { filePath, format }: { filePath: string; format: 'csv' | 'xlsx' }) => {
      if (format === 'xlsx') throw new Error('XLSX import not yet supported')
      const rows = parseCsv(fs.readFileSync(filePath, 'utf-8'))
      let count = 0
      for (const row of rows) {
        if (!row.language1 || !row.language2 || !row.text_language1 || !row.text_language2) continue
        if (row.mod_name) repos.mod.upsert(row.mod_name)
        repos.dictionary.upsert({
          sourceLang: row.language1,
          targetLang: row.language2,
          sourceText: row.text_language1,
          targetText: row.text_language2,
          modName: row.mod_name || undefined,
          uid: row.uid || undefined
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
        lang1,
        lang2,
        format,
        outputPath
      }: { lang1: string; lang2: string; format: 'csv' | 'xlsx'; outputPath: string }
    ) => {
      if (format === 'xlsx') throw new Error('XLSX export not yet supported')
      const entries = repos.dictionary.getAll(lang1, lang2)
      const header = 'id,language1,language2,text_language1,text_language2,mod_name,uid'
      const lines = entries.map((e) =>
        [
          e.id,
          e.language1,
          e.language2,
          csvCell(e.textLanguage1),
          csvCell(e.textLanguage2),
          e.modName ?? '',
          e.uid ?? ''
        ].join(',')
      )
      fs.mkdirSync(path.dirname(outputPath), { recursive: true })
      fs.writeFileSync(outputPath, [header, ...lines].join('\n'), 'utf-8')
      return { success: true }
    }
  )
}
