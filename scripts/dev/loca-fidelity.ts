// Dev utility: read a .loca and rewrite it through writeLoca, then byte-compare
// with the original to find any formatting divergence from lslib-compatible files.
// Usage: tsx scripts/dev/loca-fidelity.ts <file.loca>

import fs from 'node:fs'
import { readLoca } from '../../src/main/services/loca/loca-reader'
import { writeLoca } from '../../src/main/services/loca/loca-writer'

async function main() {
  const input = process.argv[2]
  if (!input) {
    console.error('Usage: tsx scripts/dev/loca-fidelity.ts <file.loca>')
    process.exit(1)
  }
  const original = fs.readFileSync(input)
  const entries = readLoca(original)
  const rebuilt = writeLoca(entries)
  console.log(`original: ${original.length} bytes | rebuilt: ${rebuilt.length} bytes`)
  if (original.compare(rebuilt) === 0) {
    console.log('BYTE-IDENTICAL: our writer reproduces this file exactly')
    return
  }
  const n = Math.min(original.length, rebuilt.length)
  let diff = -1
  for (let i = 0; i < n; i++) {
    if (original[i] !== rebuilt[i]) {
      diff = i
      break
    }
  }
  console.log(`first difference at offset ${diff} (of ${n} shared)`)
  const start = Math.max(0, diff - 16)
  const hex = (b: Buffer) =>
    [...b.subarray(start, start + 32)].map((x) => x.toString(16).padStart(2, '0')).join(' ')
  console.log(`original: ${hex(original)}`)
  console.log(`rebuilt : ${hex(rebuilt)}`)
  let diffs = 0
  for (let i = 0; i < n; i++) if (original[i] !== rebuilt[i]) diffs++
  console.log(`total differing bytes (shared range): ${diffs}`)
}
main()
