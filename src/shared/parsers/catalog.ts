import type { ExportFormat, ParserManifest } from './types'

export const GENERIC_EXPORT_FORMATS: ExportFormat[] = ['csv', 'json']

export const PARSER_CATALOG: ParserManifest[] = [
  {
    id: 'csv',
    name: 'CSV',
    kind: 'generic',
    status: 'ready',
    extensions: ['csv'],
    nativeExportFormats: []
  },
  {
    id: 'bg3',
    name: "Baldur's Gate 3",
    kind: 'game',
    status: 'ready',
    extensions: ['xml', 'loca', 'pak', 'zip'],
    nativeExportFormats: ['xml', 'loca', 'pak', 'zip']
  },
  {
    id: 'skyrim',
    name: 'The Elder Scrolls V: Skyrim',
    kind: 'game',
    status: 'comingSoon',
    extensions: [],
    nativeExportFormats: []
  },
  {
    id: 'until-then',
    name: 'Until Then',
    kind: 'game',
    status: 'comingSoon',
    extensions: [],
    nativeExportFormats: []
  }
]

export function getParser(id: string): ParserManifest | undefined {
  return PARSER_CATALOG.find((parser) => parser.id === id)
}

export function readyParsers(): ParserManifest[] {
  return PARSER_CATALOG.filter((parser) => parser.status === 'ready')
}

export function parsersByKind(kind: ParserManifest['kind']): ParserManifest[] {
  return PARSER_CATALOG.filter((parser) => parser.kind === kind)
}

export function exportFormatsFor(parser: ParserManifest): ExportFormat[] {
  const seen = new Set<ExportFormat>()
  const formats: ExportFormat[] = []
  for (const format of [...parser.nativeExportFormats, ...GENERIC_EXPORT_FORMATS]) {
    if (seen.has(format)) continue
    seen.add(format)
    formats.push(format)
  }
  return formats
}

export function parserAcceptsExtension(parser: ParserManifest, fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  return parser.extensions.includes(ext)
}

function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

export function searchParsers(query: string, parsers = PARSER_CATALOG): ParserManifest[] {
  const needle = normalizeSearch(query.trim())
  if (!needle) return parsers
  return parsers.filter((parser) => {
    const haystack = normalizeSearch([parser.name, parser.id, ...parser.extensions].join(' '))
    return haystack.includes(needle)
  })
}
