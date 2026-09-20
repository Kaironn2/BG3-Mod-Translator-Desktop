import fs from 'node:fs'
import { guessCsvColumns } from '../../../shared/parsers/csv-columns'
import type { CsvColumnMap } from '../../../shared/parsers/types'
import { parseCsvTable } from '../../utils/csv'

export interface CsvProjectPreview {
  headers: string[]
  totalRows: number
  sampleRows: string[][]
  guessed: CsvColumnMap
}

export function previewCsvProject(filePath: string, sampleSize = 6): CsvProjectPreview {
  const content = fs.readFileSync(filePath, 'utf-8')
  const table = parseCsvTable(content)
  return {
    headers: table.headers,
    totalRows: table.rows.length,
    sampleRows: table.rows.slice(0, sampleSize),
    guessed: guessCsvColumns(table.headers)
  }
}
