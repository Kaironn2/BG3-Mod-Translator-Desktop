// Dev utility: list the file table of a BG3 V18 .pak without extracting.
// Usage: pnpm dlx tsx scripts/dev/inspect-pak.ts <file.pak> [name-filter]

import fs from 'node:fs'
import { parseFileEntries, readHeader } from '../../src/main/services/pak/pak-binio'
import { decompress } from '../../src/main/services/pak/pak-compression'
import {
  FILE_ENTRY_SIZE,
  getCompressionLevel,
  getCompressionMethod,
  HEADER_TOTAL_SIZE,
  LSPK_SIGNATURE,
  LSPK_VERSION_BG3
} from '../../src/main/services/pak/pak-format'

async function main() {
  const [pakArg, filter] = [process.argv[2], process.argv[3]]
  if (!pakArg) {
    console.error('Usage: pnpm dlx tsx scripts/dev/inspect-pak.ts <file.pak> [name-filter]')
    process.exit(1)
  }

  const fh = fs.openSync(pakArg, 'r')
  const head = Buffer.alloc(HEADER_TOTAL_SIZE)
  fs.readSync(fh, head, 0, HEADER_TOTAL_SIZE, 0)
  if (head.readUInt32LE(0) !== LSPK_SIGNATURE) throw new Error('bad signature')
  const header = readHeader(head, 4)
  console.log(`pak: ${pakArg}`)
  console.log(
    `version=${header.version} parts=${header.numParts} flags=0x${header.flags.toString(16)} fileListOffset=${header.fileListOffset} fileListSize=${header.fileListSize}`
  )

  const info = Buffer.alloc(8)
  fs.readSync(fh, info, 0, 8, Number(header.fileListOffset))
  const numFiles = info.readUInt32LE(0)
  const compressedSize = info.readUInt32LE(4)
  const compressed = Buffer.alloc(compressedSize)
  fs.readSync(fh, compressed, 0, compressedSize, Number(header.fileListOffset) + 8)
  const table = await decompress(compressed, numFiles * FILE_ENTRY_SIZE, 0x02)
  const entries = parseFileEntries(table, numFiles)

  console.log(`files: ${numFiles}`)
  for (const e of entries) {
    if (filter && !e.name.includes(filter)) continue
    const method = getCompressionMethod(e.flags)
    const level = getCompressionLevel(e.flags)
    const size = e.uncompressedSize > 0 ? e.uncompressedSize : e.sizeOnDisk
    console.log(`  ${e.name} | method=${method} level=${level} onDisk=${e.sizeOnDisk} raw=${size}`)
  }
  fs.closeSync(fh)
}
main()
