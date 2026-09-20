import fs from 'node:fs'
import type { ProjectExportEntry } from '../csv/export'

export function exportProjectJson(outputPath: string, entries: ProjectExportEntry[]): void {
  const payload = entries.map((entry) => ({
    uid: entry.uid,
    source: entry.source,
    target: entry.target
  }))
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
}
