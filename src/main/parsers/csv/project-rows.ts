import type { CsvColumnMap } from '../../../shared/parsers/types'
import type { CsvTable } from '../../utils/csv'

export interface CsvProjectRow {
  uid: string
  source: string
  target: string
}

export function csvTableToProjectRows(table: CsvTable, columnMap: CsvColumnMap): CsvProjectRow[] {
  const sourceIndex = table.headers.indexOf(columnMap.sourceColumn)
  if (sourceIndex < 0) throw new Error('CSV source column was not found')
  const targetIndex = columnMap.targetColumn ? table.headers.indexOf(columnMap.targetColumn) : -1
  const uidIndex = columnMap.uidColumn ? table.headers.indexOf(columnMap.uidColumn) : -1

  const rows: CsvProjectRow[] = []
  for (let index = 0; index < table.rows.length; index++) {
    const row = table.rows[index]
    const source = row[sourceIndex]?.trim() ?? ''
    if (!source) continue
    const uid = uidIndex >= 0 ? row[uidIndex]?.trim() || `csv-${index + 1}` : `csv-${index + 1}`
    const target = targetIndex >= 0 ? (row[targetIndex]?.trim() ?? '') : ''
    rows.push({ uid, source, target })
  }
  return rows
}
