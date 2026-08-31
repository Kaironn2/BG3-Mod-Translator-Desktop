import fs from 'node:fs'
import path from 'node:path'
import { hasLocaSignature, readLoca } from './loca/loca-reader'

export interface LocalizationEntry {
  contentuid: string
  version: string
  text: string
}

// Unified localization reader: accepts LocaXML (.xml) and binary .loca transparently.
// The binary stores markup raw; LocaXML stores it entity-escaped, so callers that
// compare against decoded UI text must decode .xml entries (decodeEntities) while
// .loca text is already raw.
export function parseLocalizationFile(filePath: string): LocalizationEntry[] {
  if (filePath.toLowerCase().endsWith('.loca')) {
    return readLoca(fs.readFileSync(filePath)).map((entry) => ({
      contentuid: entry.key,
      version: String(entry.version),
      // Markup is raw in the binary; re-escape so downstream XML writers keep it intact.
      text: entry.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }))
  }
  return parseLocalizationXml(filePath)
}

export { hasLocaSignature }

// Regex-based parse to preserve mixed content (LSTag elements inside text nodes).
// fast-xml-parser would strip inner XML - raw regex keeps it intact.
export function parseLocalizationXml(filePath: string): LocalizationEntry[] {
  const raw = fs.readFileSync(filePath, 'utf-8')
  const entries: LocalizationEntry[] = []
  const re = /<content\s+contentuid="([^"]+)"\s+version="([^"]+)">([\s\S]*?)<\/content>/g
  let match = re.exec(raw)
  while (match !== null) {
    entries.push({ contentuid: match[1], version: match[2], text: match[3] })
    match = re.exec(raw)
  }
  return entries
}

export function writeLocalizationXml(entries: LocalizationEntry[], outputPath: string): void {
  const lines = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<contentList>',
    ...entries.map(
      (e) => `\t<content contentuid="${e.contentuid}" version="${e.version}">${e.text}</content>`
    ),
    '</contentList>'
  ]
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8')
}

// Returns every localization file (.xml or .loca) inside any Localization/{langFolder}/
// folder below dir. Binary .loca files are only matched in the exact language folder:
// the game only loads them when named as the language (e.g. brazilianportuguese.loca).
export function findLocalizationXmls(dir: string, langFolder: string): string[] {
  const results: string[] = []
  collectLocalizationFiles(dir, langFolder, results)
  return results.sort((a, b) => a.localeCompare(b))
}

function collectLocalizationFiles(dir: string, langFolder: string, results: string[]): void {
  if (!fs.existsSync(dir)) return

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectLocalizationFiles(full, langFolder, results)
      continue
    }
    const lower = entry.name.toLowerCase()
    const isXml = lower.endsWith('.xml')
    const isLoca = lower.endsWith('.loca')
    if (!isXml && !isLoca) continue
    if (isInsideLanguageFolder(full, langFolder)) {
      results.push(full)
    }
  }
}

function isInsideLanguageFolder(filePath: string, langFolder: string): boolean {
  const parts = filePath.split(/[\\/]/)
  return parts.some((part, index) => part === 'Localization' && parts[index + 1] === langFolder)
}