// Binary .loca reader. Mirrors LSLib LocaReader: validate the signature, read the
// entry table, seek to TextsOffset when it does not directly follow the table,
// then read (Length - 1) UTF-8 bytes plus one NUL terminator per entry.

import {
  LOCA_ENTRY_SIZE,
  LOCA_HEADER_SIZE,
  LOCA_KEY_SIZE,
  LOCA_SIGNATURE,
  type LocaEntry
} from './loca-format'

export function hasLocaSignature(buf: Buffer): boolean {
  return buf.length >= 4 && buf.readUInt32LE(0) === LOCA_SIGNATURE
}

export function readLoca(buf: Buffer): LocaEntry[] {
  if (buf.length < LOCA_HEADER_SIZE) {
    throw new Error('Buffer too small for LOCA header')
  }
  const signature = buf.readUInt32LE(0)
  if (signature !== LOCA_SIGNATURE) {
    throw new Error(`Incorrect signature in localization file: 0x${signature.toString(16)}`)
  }

  const numEntries = buf.readUInt32LE(4)
  const textsOffset = buf.readUInt32LE(8)

  const tableSize = numEntries * LOCA_ENTRY_SIZE
  if (buf.length < LOCA_HEADER_SIZE + tableSize) {
    throw new Error(
      `Loca entry table too small: expected ${LOCA_HEADER_SIZE + tableSize} bytes, got ${buf.length}`
    )
  }

  const metadata: { key: string; version: number; length: number }[] = new Array(numEntries)
  for (let i = 0; i < numEntries; i++) {
    const base = LOCA_HEADER_SIZE + i * LOCA_ENTRY_SIZE
    const key = readNullTerminatedKey(buf, base)
    const version = buf.readUInt16LE(base + LOCA_KEY_SIZE)
    const length = buf.readUInt32LE(base + LOCA_KEY_SIZE + 2)
    metadata[i] = { key, version, length }
  }

  // lslib tolerance: the text pool starts at TextsOffset, which normally sits
  // right after the entry table. Seek there instead of failing when a file
  // disagrees (e.g. padding between the table and the texts).
  let p = LOCA_HEADER_SIZE + tableSize
  if (p !== textsOffset) p = textsOffset
  if (p > buf.length) {
    throw new Error(
      `Loca texts offset out of bounds: ${textsOffset} (buffer is ${buf.length} bytes)`
    )
  }

  const entries: LocaEntry[] = new Array(numEntries)
  for (let i = 0; i < numEntries; i++) {
    const { key, version, length } = metadata[i]
    // Length 0 cannot come from lslib's writer (it always adds the NUL), but do
    // not crash either: treat it as an empty text with no terminator.
    if (length === 0) {
      entries[i] = { key, version, text: '' }
      continue
    }
    if (p + length > buf.length) {
      throw new Error(
        `Loca text pool too small for entry ${i} (${key}): need ${length} bytes at offset ${p}, buffer has ${buf.length}`
      )
    }
    const text = buf.toString('utf8', p, p + length - 1)
    p += length
    entries[i] = { key, version, text }
  }
  return entries
}

function readNullTerminatedKey(buf: Buffer, offset: number): string {
  let end = offset
  const limit = offset + LOCA_KEY_SIZE
  while (end < limit && buf[end] !== 0) end++
  return buf.toString('utf8', offset, end)
}
