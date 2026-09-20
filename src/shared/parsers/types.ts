export type ParserKind = 'generic' | 'game'
export type ParserStatus = 'ready' | 'comingSoon'
export type ParserCapability = 'translate' | 'extract' | 'package'
export type NativeExportFormat = 'xml' | 'loca' | 'pak' | 'zip'
export type GenericExportFormat = 'csv' | 'json'
export type ExportFormat = NativeExportFormat | GenericExportFormat

export interface ParserManifest {
  id: string
  name: string
  kind: ParserKind
  status: ParserStatus
  extensions: string[]
  nativeExportFormats: NativeExportFormat[]
  capabilities: ParserCapability[]
}

export interface CsvColumnMap {
  sourceColumn: string
  targetColumn: string | null
  uidColumn: string | null
}
