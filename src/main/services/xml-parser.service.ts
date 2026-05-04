import fs from 'fs'
import path from 'path'

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
  let match: RegExpExecArray | null
  while ((match = re.exec(raw)) !== null) {
    entries.push({ contentuid: match[1], version: match[2], text: match[3] })
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

// Returns every .xml file inside a Localization/{langCode}/ folder within a given directory.
export function findLocalizationXmls(dir: string, langCode: string): string[] {
  const locDir = path.join(dir, 'Localization', langCode)
  if (!fs.existsSync(locDir)) return []
  return fs
    .readdirSync(locDir)
    .filter((f) => f.endsWith('.xml'))
    .map((f) => path.join(locDir, f))
}
