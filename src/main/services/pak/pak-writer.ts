// Writes a directory tree as a BG3 V18 .pak (LSPK).
// Mirrors the logic of LSLib's PackageWriter_V15<LSPKHeader16, FileEntry18>.

import fs from 'fs/promises'
import path from 'path'

import { serializeFileEntries, writeHeader } from './pak-binio'
import { compress } from './pak-compression'
import {
  CompressionLevel,
  CompressionMethod,
  HEADER_TOTAL_SIZE,
  LSPK_SIGNATURE,
  LSPK_VERSION_BG3,
  PackageFlags,
  V18_PADDING_BYTE,
  V18_PADDING_SIZE,
  makeCompressionFlags,
  shouldCompress,
  type FileEntry,
} from './pak-format'

export interface WritePackageOptions {
  compression?: CompressionMethod
  compressionLevel?: CompressionLevel
}

interface InputFile {
  absolutePath: string
  relativePath: string
}

export async function writePackage(
  inputDir: string,
  outputPak: string,
  options: WritePackageOptions = {},
): Promise<void> {
  const compression = options.compression ?? CompressionMethod.LZ4
  const compressionLevel = options.compressionLevel ?? CompressionLevel.Default

  const inputs = await collectInputFiles(inputDir)
  inputs.sort((a, b) => (a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0))

  await fs.mkdir(path.dirname(outputPak), { recursive: true })
  const handle = await fs.open(outputPak, 'w')
  try {
    // Write a zeroed placeholder for the 40-byte header; we'll seek back at the end.
    await handle.write(Buffer.alloc(HEADER_TOTAL_SIZE), 0, HEADER_TOTAL_SIZE, 0)

    const entries: FileEntry[] = []
    let cursor = HEADER_TOTAL_SIZE
    for (const file of inputs) {
      const entry = await writeOneFile(handle, file, cursor, compression, compressionLevel)
      cursor = entry.nextCursor
      entries.push(entry.entry)
    }

    const fileListOffset = BigInt(cursor)
    const tableBytes = serializeFileEntries(entries)
    const compressedTable = await compress(tableBytes, CompressionMethod.LZ4, CompressionLevel.Default)

    const tablePrefix = Buffer.alloc(8)
    tablePrefix.writeUInt32LE(entries.length, 0)
    tablePrefix.writeUInt32LE(compressedTable.length, 4)
    await handle.write(tablePrefix, 0, 8, cursor)
    await handle.write(compressedTable, 0, compressedTable.length, cursor + 8)

    const fileListSize = compressedTable.length + 8
    const headerBuf = Buffer.alloc(HEADER_TOTAL_SIZE)
    headerBuf.writeUInt32LE(LSPK_SIGNATURE, 0)
    writeHeader(headerBuf, 4, {
      version: LSPK_VERSION_BG3,
      fileListOffset,
      fileListSize,
      flags: PackageFlags.None,
      priority: 0,
      md5: Buffer.alloc(16),
      numParts: 1,
    })
    await handle.write(headerBuf, 0, HEADER_TOTAL_SIZE, 0)
  } finally {
    await handle.close()
  }
}

async function writeOneFile(
  handle: fs.FileHandle,
  file: InputFile,
  cursor: number,
  compressionMethod: CompressionMethod,
  compressionLevel: CompressionLevel,
): Promise<{ entry: FileEntry; nextCursor: number }> {
  const uncompressed = await fs.readFile(file.absolutePath)

  let method = compressionMethod
  let level = compressionLevel
  if (!shouldCompress(file.relativePath, uncompressed.length)) {
    method = CompressionMethod.None
    level = CompressionLevel.Fast
  }

  const compressed = await compress(uncompressed, method, level)

  const offsetInFile = BigInt(cursor)
  if (compressed.length > 0) {
    await handle.write(compressed, 0, compressed.length, cursor)
  }
  let nextCursor = cursor + compressed.length

  // V18 padding: align next write to a 64-byte boundary measured from offset HEADER_TOTAL_SIZE.
  const padBytes = (V18_PADDING_SIZE - ((nextCursor - HEADER_TOTAL_SIZE) % V18_PADDING_SIZE)) % V18_PADDING_SIZE
  if (padBytes > 0) {
    const pad = Buffer.alloc(padBytes, V18_PADDING_BYTE)
    await handle.write(pad, 0, padBytes, nextCursor)
    nextCursor += padBytes
  }

  return {
    entry: {
      name: file.relativePath,
      offsetInFile,
      archivePart: 0,
      flags: makeCompressionFlags(method, level),
      sizeOnDisk: compressed.length,
      uncompressedSize: method === CompressionMethod.None ? 0 : uncompressed.length,
    },
    nextCursor,
  }
}

async function collectInputFiles(inputDir: string): Promise<InputFile[]> {
  const out: InputFile[] = []
  await walk(inputDir, '', out)
  return out
}

async function walk(rootDir: string, relativeDir: string, out: InputFile[]): Promise<void> {
  const fullDir = relativeDir ? path.join(rootDir, relativeDir) : rootDir
  const entries = await fs.readdir(fullDir, { withFileTypes: true })
  for (const dirent of entries) {
    if (dirent.name.startsWith('.')) continue
    const childRelative = relativeDir ? `${relativeDir}/${dirent.name}` : dirent.name
    if (dirent.isDirectory()) {
      await walk(rootDir, childRelative, out)
    } else if (dirent.isFile()) {
      out.push({
        absolutePath: path.join(rootDir, childRelative),
        relativePath: childRelative,
      })
    }
  }
}
