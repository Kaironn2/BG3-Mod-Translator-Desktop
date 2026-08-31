// Dev utility: inspect a binary .loca file without converting it.
// Usage: pnpm dlx tsx scripts/dev/inspect-loca.ts <file.loca>

import fs from 'node:fs'
import { readLoca } from '../../src/main/services/loca/loca-reader'

const input = process.argv[2]
if (!input) {
  console.error('Usage: pnpm dlx tsx scripts/dev/inspect-loca.ts <file.loca>')
  process.exit(1)
}

const buf = fs.readFileSync(input)
const magic = buf.toString('ascii', 0, 4)
const numEntries = buf.readUInt32LE(4)
const textsOffset = buf.readUInt32LE(8)
const tableEnd = 12 + numEntries * 70
console.log(`file:     ${input}`)
console.log(`size:     ${buf.length}`)
console.log(`magic:    ${magic}`)
console.log(`entries:  ${numEntries}`)
console.log(`tableEnd: ${tableEnd}`)
console.log(`textOff:  ${textsOffset}`)
console.log(`padding:  ${textsOffset - tableEnd} bytes between table and texts`)

const entries = readLoca(buf)
console.log(`parsed:   ${entries.length} entries`)
for (const e of entries.slice(0, 2)) {
  console.log(
    `  [${e.key}] v${e.version} len=${Buffer.byteLength(e.text)} :: ${e.text.slice(0, 60)}`
  )
}
for (const e of entries.slice(-1)) {
  console.log(`  last: [${e.key}] v${e.version} :: ${e.text.slice(0, 60)}`)
}
const versions = new Set(entries.map((e) => e.version))
console.log(`versions: ${[...versions].join(', ')}`)
