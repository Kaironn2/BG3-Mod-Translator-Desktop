// Dev utility: check whether a .loca's keys (and a LocaXML's contentuids) are
// byte-sorted, plus stats on the key order.
// Usage: pnpm dlx tsx scripts/dev/check-sorted.ts <file.loca|file.xml>

import fs from 'node:fs'
import { readLoca } from '../../src/main/services/loca/loca-reader'
import { parseLocalizationXml } from '../../src/main/services/xml-parser.service'

async function main() {
  const input = process.argv[2]
  if (!input) {
    console.error('Usage: tsx scripts/dev/check-sorted.ts <file.loca|file.xml>')
    process.exit(1)
  }
  const isXml = /\.xml$/i.test(input)
  const keys = isXml
    ? parseLocalizationXml(input).map((e) => Buffer.from(e.contentuid, 'utf8'))
    : readLoca(fs.readFileSync(input)).map((e) => Buffer.from(e.key, 'utf8'))
  let sorted = 0
  let unsorted = 0
  for (let i = 1; i < keys.length; i++) {
    if (keys[i - 1].compare(keys[i]) <= 0) sorted++
    else unsorted++
  }
  console.log(`${input}`)
  console.log(
    `  entries: ${keys.length} | pairs in order: ${sorted} | pairs out of order: ${unsorted}`
  )
  console.log(`  first:   ${keys[0]?.toString().slice(0, 40)}`)
  console.log(`  second:  ${keys[1]?.toString().slice(0, 40)}`)
  console.log(`  last:    ${keys.at(-1)?.toString().slice(0, 40)}`)
}
main()
