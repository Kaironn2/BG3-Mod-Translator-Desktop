import fs from 'node:fs'
import path from 'node:path'

export interface LocalizationEntry {
  contentuid: string
  version: string
  text: string
}

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

// Returns every .xml file inside any Localization/{langFolder}/ folder below dir.
export function findLocalizationXmls(dir: string, langFolder: string): string[] {
  const results: string[] = []
  collectLocalizationXmls(dir, langFolder, results)
  return results.sort((a, b) => a.localeCompare(b))
}

function collectLocalizationXmls(dir: string, langFolder: string, results: string[]): void {
  if (!fs.existsSync(dir)) return

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectLocalizationXmls(full, langFolder, results)
    } else if (entry.name.endsWith('.xml') && isInsideLanguageFolder(full, langFolder)) {
      results.push(full)
    }
  }
}

function isInsideLanguageFolder(filePath: string, langFolder: string): boolean {
  const parts = filePath.split(/[\\/]/)
  return parts.some((part, index) => part === 'Localization' && parts[index + 1] === langFolder)
}
