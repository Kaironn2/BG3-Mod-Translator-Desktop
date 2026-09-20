import { ipcMain } from 'electron'
import { exportFormatsFor, getParser } from '../../shared/parsers/catalog'
import type { CsvColumnMap } from '../../shared/parsers/types'
import { exportProjectCsv } from '../parsers/csv/export'
import { previewCsvProject } from '../parsers/csv/preview'
import { exportProjectJson } from '../parsers/generic/export-json'

export function registerParserHandlers(): void {
  ipcMain.handle('parser:previewCsv', (_event, params: { filePath: string }) => {
    return previewCsvProject(params.filePath)
  })

  ipcMain.handle(
    'parser:exportProject',
    (
      _event,
      params: {
        parserId: string
        format: 'csv' | 'json'
        outputPath: string
        entries: { uid: string; source: string; target: string }[]
      }
    ) => {
      const parser = getParser(params.parserId)
      if (!parser || parser.status !== 'ready') {
        throw new Error('Parser is not available')
      }
      const allowed = exportFormatsFor(parser)
      if (!allowed.includes(params.format)) {
        throw new Error(`Export format ${params.format} is not available for ${parser.name}`)
      }
      if (params.format === 'json') {
        exportProjectJson(params.outputPath, params.entries)
      } else {
        exportProjectCsv(params.outputPath, params.entries)
      }
      return { success: true }
    }
  )
}

export type { CsvColumnMap }
