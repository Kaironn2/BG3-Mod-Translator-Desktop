// Dev utility: convert a binary BG3 .loca file into LocaXML (.xml).
// Usage: pnpm dlx tsx scripts/dev/loca-to-xml.ts <input.loca> [output.xml]
//
// Uses the isolated loca reader plus the shared XML writer; not wired into any
// app flow. Markup stored raw in the binary (e.g. <LSTag/>) is re-escaped, and
// the result is verified by parsing the XML back and comparing every entry.

import fs from 'node:fs'
import path from 'node:path'
import { readLoca } from '../../src/main/services/loca/loca-reader'
import type { LocalizationEntry } from '../../src/main/services/xml-parser.service'
import { parseLocalizationXml, writeLocalizationXml } from '../../src/main/services/xml-parser.service'

const [, , inputArg, outputArg] = process.argv
if (!inputArg) {
  console.error('Usage: pnpm dlx tsx scripts/dev/loca-to-xml.ts <input.loca> [output.xml]')
  process.exit(1)
}

const input = path.resolve(inputArg)
const output = path.resolve(outputArg ?? input.replace(/\.loca$/i, '.xml'))

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', quot: '"', apos: "'" }

const buf = fs.readFileSync(input)
const entries = readLoca(buf)

// The binary stores markup raw; LocaXML needs it entity-escaped. & first so
// existing entities are not double-escaped, then the angle brackets.
const xmlEntries: LocalizationEntry[] = entries.map((e) => ({
  contentuid: e.key,
  version: String(e.version),
  text: e.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}))

writeLocalizationXml(xmlEntries, output)

console.log(`Parsed ${entries.length} entries from ${input} (${buf.length} bytes)`)
console.log(`Wrote ${output} (${fs.statSync(output).size} bytes)`)

// Verification: re-parse the generated XML and compare against the binary.
const readBack = parseLocalizationXml(output).map((e) => decodeXmlEntities(e.text))
const mismatches = entries.filter(
  (e, i) => e.text !== readBack[i] || xmlEntries[i].contentuid !== e.key
)
if (mismatches.length > 0 || readBack.length !== entries.length) {
  console.error(`VERIFICATION FAILED: ${mismatches.length} mismatches (parsed ${readBack.length})`)
  for (const m of mismatches.slice(0, 3)) console.error(`  key ${m.key}`)
  process.exit(1)
}
console.log('Round-trip verified: all texts match after re-encoding entities to XML')

const sampleWithMarkup = entries.findIndex((e) => e.text.includes('<LSTag'))
if (sampleWithMarkup >= 0) {
  console.log(`Sample escaped markup (entry #${sampleWithMarkup}):`)
  console.log(`  ${xmlEntries[sampleWithMarkup].text.slice(0, 120)}`)
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&(lt|gt|quot|apos);/g, (m, ent: string) => ENTITIES[ent] ?? m)
    .replace(/&amp;/g, '&')
}
