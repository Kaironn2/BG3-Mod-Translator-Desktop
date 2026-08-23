import fs from 'node:fs'
import { parseCsvTable } from './csv'

export interface DictionaryImportRow {
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

export function readImportCsv(filePath: string): {
  headers: string[]
  rows: DictionaryImportRow[]
} {
  const content = fs.readFileSync(filePath, 'utf-8')
  const table = parseCsvTable(content)
  if (table.headers.length === 0) return { headers: [], rows: [] }

  const rows = table.rows.map((row) =>
    normalizeRow(
      Object.fromEntries(table.headers.map((header, index) => [header, row[index]?.trim() ?? '']))
    )
  )
  return { headers: table.headers, rows }
}

export function readImportCsvPreview(
  filePath: string,
  sampleSize = 5
): { headers: string[]; totalRows: number; rows: DictionaryImportRow[] } {
  const { headers, rows } = readImportCsv(filePath)
  return { headers, totalRows: rows.length, rows: rows.slice(0, sampleSize) }
}

function normalizeRow(row: Record<string, string>): DictionaryImportRow {
  return {
    sourceLang: readColumn(row, HEADER_ALIASES.sourceLang),
    targetLang: readColumn(row, HEADER_ALIASES.targetLang),
    sourceText: readColumn(row, HEADER_ALIASES.sourceText),
    targetText: readColumn(row, HEADER_ALIASES.targetText),
    modName: readColumn(row, HEADER_ALIASES.modName) || null,
    uid: readColumn(row, HEADER_ALIASES.uid) || null
  }
}

function readColumn(row: Record<string, string>, aliases: readonly string[]): string {
  for (const alias of aliases) {
    if (alias in row) return row[alias]?.trim() ?? ''
  }
  return ''
}
