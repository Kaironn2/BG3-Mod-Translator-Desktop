// Dev utility: convert a LocaXML (.xml) file into a binary BG3 .loca file.
// Usage: pnpm dlx tsx scripts/dev/xml-to-loca.ts <input.xml> [output.loca]
//
// Uses the isolated loca services (readLoca/writeLoca only) plus the shared XML
// parser; not wired into any app flow. Verifies the result by parsing the
// binary back and comparing every entry against the XML source.

import fs from 'node:fs'
import path from 'node:path'
import { hasLocaSignature, readLoca } from '../../src/main/services/loca/loca-reader'
import { writeLoca } from '../../src/main/services/loca/loca-writer'
import { parseLocalizationXml } from '../../src/main/services/xml-parser.service'

const [, , inputArg, outputArg] = process.argv
if (!inputArg) {
  console.error('Usage: pnpm dlx tsx scripts/dev/xml-to-loca.ts <input.xml> [output.loca]')
  process.exit(1)
}

const input = path.resolve(inputArg)
const output = path.resolve(outputArg ?? input.replace(/\.xml$/i, '.loca'))

const ENTITIES: Record<string, string> = { lt: '<', gt: '>', quot: '"', apos: "'" }

const entries = parseLocalizationXml(input)
const locaEntries = entries.map((e) => ({
  key: e.contentuid,
  version: Number.parseInt(e.version, 10) || 1,
  // LocaXML escapes markup inside text (e.g. &lt;LSTag/&gt;); the binary
  // format stores it raw, so decode the XML entities first.
  text: decodeXmlEntities(e.text)
}))

const buf = writeLoca(locaEntries)
fs.writeFileSync(output, buf)

console.log(`Parsed ${entries.length} entries from ${input}`)
console.log(`Wrote ${output} (${buf.length} bytes)`)

if (!hasLocaSignature(buf)) {
  console.error('VERIFICATION FAILED: signature missing')
  process.exit(1)
}

const readBack = readLoca(buf)
let mismatches = 0
if (readBack.length !== locaEntries.length) mismatches = locaEntries.length
for (let i = 0; i < locaEntries.length; i++) {
  if (readBack[i]?.key !== locaEntries[i].key || readBack[i]?.text !== locaEntries[i].text) {
    mismatches++
    console.error(`Mismatch at #${i}: ${locaEntries[i].key}`)
  }
}

if (mismatches > 0) {
  console.error(`VERIFICATION FAILED: ${mismatches} round-trip mismatches`)
  process.exit(1)
}
console.log('Round-trip verified: all entries match after decoding entities')

const sampleWithMarkup = locaEntries.findIndex((e) => e.text.includes('<LSTag'))
if (sampleWithMarkup >= 0) {
  console.log(`Sample decoded markup (entry #${sampleWithMarkup}):`)
  console.log(`  ${locaEntries[sampleWithMarkup].text.slice(0, 120)}`)
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&(lt|gt|quot|apos);/g, (m, ent: string) => ENTITIES[ent] ?? m)
    .replace(/&amp;/g, '&')
}
