import fs from 'node:fs'
import { csvCell } from '../../utils/csv'

export interface ProjectExportEntry {
  uid: string
  source: string
  target: string
}

export function exportProjectCsv(outputPath: string, entries: ProjectExportEntry[]): void {
  const lines = [
    ['uid', 'source', 'target'].map(csvCell).join(','),
    ...entries.map((entry) => [entry.uid, entry.source, entry.target].map(csvCell).join(','))
  ]
  fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf-8')
}
