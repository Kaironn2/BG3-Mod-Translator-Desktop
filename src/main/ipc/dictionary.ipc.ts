import { ipcMain } from 'electron'
import { and, eq, like, or } from 'drizzle-orm'
import fs from 'fs'
import path from 'path'
import { getDb } from '../database/connection'
import { dictionary } from '../database/schema'
import { DictionaryRepository } from '../database/repositories/dictionary.repo'
import { ModRepository } from '../database/repositories/mod.repo'
import { findSimilar } from '../services/similarity.service'
import { csvCell, parseCsv } from '../utils/csv'
import { normalizeLangs } from '../utils/languages'

export function registerDictionaryHandlers(): void {
  ipcMain.handle(
    'dictionary:getAll',
    (_event, { lang1, lang2 }: { lang1: string; lang2: string }) => {
      const db = getDb()
      const repo = new DictionaryRepository(db)
      return repo.getAll(lang1, lang2)
    }
  )

  ipcMain.handle(
    'dictionary:search',
    (_event, { text, lang1, lang2 }: { text: string; lang1: string; lang2: string }) => {
      const db = getDb()
      const [l1, l2] = normalizeLangs(lang1, lang2)
      const pattern = `%${text}%`
      return db
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
      const db = getDb()
      const repo = new DictionaryRepository(db)
      repo.upsert({
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
    const db = getDb()
    const repo = new DictionaryRepository(db)
    repo.delete(id)
    return { success: true }
  })

  ipcMain.handle(
    'dictionary:similar',
    (
      _event,
      { text, lang1, lang2, limit }: { text: string; lang1: string; lang2: string; limit?: number }
    ) => {
      const db = getDb()
      const repo = new DictionaryRepository(db)
      const corpus = repo.getAllForSimilarity(lang1, lang2)
      return findSimilar(text, corpus, limit ?? 5)
    }
  )

  ipcMain.handle(
    'dictionary:import',
    (_event, { filePath, format }: { filePath: string; format: 'csv' | 'xlsx' }) => {
      if (format === 'xlsx') throw new Error('XLSX import not yet supported')
      const db = getDb()
      const repo = new DictionaryRepository(db)
      const modRepo = new ModRepository(db)
      const rows = parseCsv(fs.readFileSync(filePath, 'utf-8'))
      let count = 0
      for (const row of rows) {
        if (!row.language1 || !row.language2 || !row.text_language1 || !row.text_language2) continue
        if (row.mod_name) modRepo.upsert(row.mod_name)
        repo.upsert({
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
      const db = getDb()
      const repo = new DictionaryRepository(db)
      const entries = repo.getAll(lang1, lang2)
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
