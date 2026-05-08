// Binary read helpers for parsing the .pak header and file entries.
// All multi-byte integers in the .pak format are little-endian.

import {
  FILE_ENTRY_SIZE,
  FILE_NAME_BYTES,
  HEADER_SIZE,
  type FileEntry,
  type PackageHeader,
} from './pak-format'

export function readHeader(buf: Buffer, offset: number): PackageHeader {
  if (buf.length < offset + HEADER_SIZE) {
    throw new Error('Buffer too small for LSPK header')
  }
  let p = offset
  const version = buf.readUInt32LE(p)
  p += 4
  const fileListOffset = buf.readBigUInt64LE(p)
  p += 8
  const fileListSize = buf.readUInt32LE(p)
  p += 4
  const flags = buf.readUInt8(p)
  p += 1
  const priority = buf.readUInt8(p)
  p += 1
  const md5 = Buffer.from(buf.subarray(p, p + 16))
  p += 16
  const numParts = buf.readUInt16LE(p)
  return { version, fileListOffset, fileListSize, flags, priority, md5, numParts }
}

export function writeHeader(buf: Buffer, offset: number, header: PackageHeader): void {
  let p = offset
  buf.writeUInt32LE(header.version, p)
  p += 4
  buf.writeBigUInt64LE(header.fileListOffset, p)
  p += 8
  buf.writeUInt32LE(header.fileListSize, p)
  p += 4
  buf.writeUInt8(header.flags, p)
  p += 1
  buf.writeUInt8(header.priority, p)
  p += 1
  if (header.md5.length !== 16) throw new Error('md5 must be 16 bytes')
  header.md5.copy(buf, p)
  p += 16
  buf.writeUInt16LE(header.numParts, p)
}

export function parseFileEntries(decompressed: Buffer, numFiles: number): FileEntry[] {
  if (decompressed.length < numFiles * FILE_ENTRY_SIZE) {
    throw new Error(
      `File list too small: expected ${numFiles * FILE_ENTRY_SIZE} bytes, got ${decompressed.length}`,
    )
  }
  const entries: FileEntry[] = new Array(numFiles)
  for (let i = 0; i < numFiles; i++) {
    const base = i * FILE_ENTRY_SIZE
    const name = readNullTerminatedName(decompressed, base, FILE_NAME_BYTES)
    let p = base + FILE_NAME_BYTES
    const offsetLow = decompressed.readUInt32LE(p)
    p += 4
    const offsetHigh = decompressed.readUInt16LE(p)
    p += 2
    const archivePart = decompressed.readUInt8(p)
    p += 1
    const flags = decompressed.readUInt8(p)
    p += 1
    const sizeOnDisk = decompressed.readUInt32LE(p)
    p += 4
    const uncompressedSize = decompressed.readUInt32LE(p)
    const offsetInFile = BigInt(offsetLow) | (BigInt(offsetHigh) << 32n)
    entries[i] = { name, offsetInFile, archivePart, flags, sizeOnDisk, uncompressedSize }
  }
  return entries
}

export function serializeFileEntries(entries: FileEntry[]): Buffer {
  const buf = Buffer.alloc(entries.length * FILE_ENTRY_SIZE)
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const base = i * FILE_ENTRY_SIZE
    writeNullTerminatedName(buf, base, FILE_NAME_BYTES, entry.name)
    let p = base + FILE_NAME_BYTES
    const offsetLow = Number(entry.offsetInFile & 0xffffffffn)
    const offsetHigh = Number((entry.offsetInFile >> 32n) & 0xffffn)
    buf.writeUInt32LE(offsetLow, p)
    p += 4
    buf.writeUInt16LE(offsetHigh, p)
    p += 2
    buf.writeUInt8(entry.archivePart, p)
    p += 1
    buf.writeUInt8(entry.flags, p)
    p += 1
    buf.writeUInt32LE(entry.sizeOnDisk, p)
    p += 4
    buf.writeUInt32LE(entry.uncompressedSize, p)
  }
  return buf
}

function readNullTerminatedName(buf: Buffer, offset: number, max: number): string {
  let end = offset
  const limit = offset + max
  while (end < limit && buf[end] !== 0) end++
  return buf.toString('utf8', offset, end)
}

function writeNullTerminatedName(buf: Buffer, offset: number, max: number, name: string): void {
  const bytes = Buffer.from(name, 'utf8')
  if (bytes.length >= max) {
    throw new Error(`File name too long for entry: ${name} (${bytes.length} bytes, max ${max - 1})`)
  }
  bytes.copy(buf, offset)
  // Remaining bytes are already zero from Buffer.alloc.
}
