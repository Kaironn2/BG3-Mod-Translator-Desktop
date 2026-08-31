// Binary .loca writer. Mirrors LSLib LocaWriter: TextsOffset and each entry's
// Length are recomputed from the actual UTF-8 bytes, never trusted from input.

import fs from 'node:fs'
import path from 'node:path'
import {
  LOCA_ENTRY_SIZE,
  LOCA_HEADER_SIZE,
  LOCA_KEY_SIZE,
  LOCA_SIGNATURE,
  type LocaEntry
} from './loca-format'

export function writeLoca(entries: readonly LocaEntry[]): Buffer {
  const textBytes = entries.map((e) => Buffer.from(e.text, 'utf8'))
  let poolSize = 0
  for (const bytes of textBytes) poolSize += bytes.length + 1

  const textsOffset = LOCA_HEADER_SIZE + entries.length * LOCA_ENTRY_SIZE
  if (textsOffset > 0xffffffff) {
    throw new Error(`Too many entries for the LOCA format: ${entries.length}`)
  }

  const buf = Buffer.alloc(textsOffset + poolSize)
  buf.writeUInt32LE(LOCA_SIGNATURE, 0)
  buf.writeUInt32LE(entries.length, 4)
  buf.writeUInt32LE(textsOffset, 8)

  let p = LOCA_HEADER_SIZE
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    writeNullTerminatedKey(buf, p, entry.key)
    buf.writeUInt16LE(validateVersion(entry.version, entry.key), p + LOCA_KEY_SIZE)
    // +1 reserves the NUL terminator written after the text bytes.
    buf.writeUInt32LE(textBytes[i].length + 1, p + LOCA_KEY_SIZE + 2)
    p += LOCA_ENTRY_SIZE
  }

  p = textsOffset
  for (const bytes of textBytes) {
    bytes.copy(buf, p)
    p += bytes.length
    buf.writeUInt8(0, p)
    p += 1
  }
  return buf
}

export function writeLocaFile(entries: readonly LocaEntry[], outputPath: string): void {
  const buf = writeLoca(entries)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, buf)
}

function validateVersion(version: number, key: string): number {
  if (!Number.isInteger(version) || version < 0 || version > 0xffff) {
    throw new Error(`Invalid loca version ${version} for key "${key}"`)
  }
  return version
}

function writeNullTerminatedKey(buf: Buffer, offset: number, key: string): void {
  const bytes = Buffer.from(key, 'utf8')
  if (bytes.length >= LOCA_KEY_SIZE) {
    throw new Error(`Loca key too long: "${key}" (${bytes.length} bytes, max ${LOCA_KEY_SIZE - 1})`)
  }
  bytes.copy(buf, offset)
  // Remaining bytes are already zero from Buffer.alloc.
}