import type { CsvColumnMap } from './types'

const SOURCE_ALIASES = [
  'source',
  'src',
  'text_language1',
  'language1',
  'origem',
  'original',
  'en',
  'english',
  'ingles'
]
const TARGET_ALIASES = [
  'target',
  'tgt',
  'text_language2',
  'language2',
  'traducao',
  'translation',
  'pt-br',
  'ptbr',
  'portuguese',
  'portugues',
  'portuguesdobrasil'
]
const UID_ALIASES = ['uid', 'key', 'id', 'contentuid', 'handle']

function normalizeHeader(header: string): string {
  return header
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

function findAlias(headers: string[], aliases: string[]): string | null {
  const normalizedAliases = new Set(aliases.map(normalizeHeader))
  for (const header of headers) {
    if (normalizedAliases.has(normalizeHeader(header))) return header
  }
  return null
}

export function guessCsvColumns(headers: string[]): CsvColumnMap {
  const cleaned = headers.map((header) => header.trim()).filter(Boolean)
  const sourceColumn = findAlias(cleaned, SOURCE_ALIASES) ?? cleaned[0] ?? ''
  const uidColumn = findAlias(cleaned, UID_ALIASES)
  let targetColumn = findAlias(cleaned, TARGET_ALIASES)
  if (targetColumn === sourceColumn || targetColumn === uidColumn) targetColumn = null
  return {
    sourceColumn,
    targetColumn,
    uidColumn: uidColumn && uidColumn !== sourceColumn ? uidColumn : null
  }
}
