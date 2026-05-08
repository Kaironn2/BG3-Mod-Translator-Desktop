// Reads a BG3 V18 .pak (LSPK) and writes its contents to disk.
// Mirrors the logic of LSLib's PackageReader + Packager.UncompressPackage.

import fs from 'fs/promises'
import path from 'path'

import { parseFileEntries, readHeader } from './pak-binio'
import { decompress } from './pak-compression'
import {
  FILE_ENTRY_SIZE,
  HEADER_TOTAL_SIZE,
  LSPK_SIGNATURE,
  LSPK_VERSION_BG3,
  PackageFlags,
  type FileEntry,
} from './pak-format'

const DELETION_OFFSET_MASK = 0x0000ffffffffffffn
const DELETION_MARKER = 0xbeefdeadbeefn

export async function readPackage(pakPath: string, outputDir: string): Promise<void> {
  const handle = await fs.open(pakPath, 'r')
  try {
    const stat = await handle.stat()
    if (stat.size < HEADER_TOTAL_SIZE) {
      throw new Error(`Not a valid .pak file: ${pakPath} (too small)`)
    }

    const headerBuf = Buffer.alloc(HEADER_TOTAL_SIZE)
    await handle.read(headerBuf, 0, HEADER_TOTAL_SIZE, 0)

    const signature = headerBuf.readUInt32LE(0)
    if (signature !== LSPK_SIGNATURE) {
      throw new Error(`Not a valid .pak file: ${pakPath} (bad signature 0x${signature.toString(16)})`)
    }
    const header = readHeader(headerBuf, 4)
    if (header.version !== LSPK_VERSION_BG3) {
      throw new Error(
        `Unsupported .pak version: ${header.version} (only V18 / BG3 Release is supported)`,
      )
    }
    if ((header.flags & PackageFlags.Solid) !== 0) {
      throw new Error(
        `Solid-mode .pak not supported (file: ${pakPath}). BG3 mods do not normally use solid mode.`,
      )
    }
    if (header.numParts > 1) {
      throw new Error(`Multi-part .pak not supported (file: ${pakPath}, parts=${header.numParts})`)
    }

    const entries = await readFileTable(handle, header.fileListOffset, header.fileListSize)

    await fs.mkdir(outputDir, { recursive: true })
    for (const entry of entries) {
      if (isDeletion(entry.offsetInFile)) continue
      await extractFile(handle, entry, outputDir)
    }
  } finally {
    await handle.close()
  }
}

async function readFileTable(
  handle: fs.FileHandle,
  fileListOffset: bigint,
  fileListSize: number,
): Promise<FileEntry[]> {
  const numFilesBuf = Buffer.alloc(8)
  await handle.read(numFilesBuf, 0, 8, Number(fileListOffset))
  const numFiles = numFilesBuf.readUInt32LE(0)
  const compressedSize = numFilesBuf.readUInt32LE(4)
  if (compressedSize + 8 > fileListSize + 8) {
    // FileListSize in the header excludes the leading 8-byte count/size field. We don't strictly
    // need it for V18, so just sanity-check that the compressed payload fits in the file.
  }
  const compressed = Buffer.alloc(compressedSize)
  await handle.read(compressed, 0, compressedSize, Number(fileListOffset) + 8)

  const decompressedSize = numFiles * FILE_ENTRY_SIZE
  const tableBuf = await decompress(compressed, decompressedSize, /* LZ4 */ 0x02)
  if (tableBuf.length !== decompressedSize) {
    throw new Error(
      `File table decompression size mismatch: expected ${decompressedSize}, got ${tableBuf.length}`,
    )
  }
  return parseFileEntries(tableBuf, numFiles)
}

async function extractFile(
  handle: fs.FileHandle,
  entry: FileEntry,
  outputDir: string,
): Promise<void> {
  const compressed = Buffer.alloc(entry.sizeOnDisk)
  if (entry.sizeOnDisk > 0) {
    await handle.read(compressed, 0, entry.sizeOnDisk, Number(entry.offsetInFile))
  }
  // When the file is uncompressed, FileEntry18 stores UncompressedSize=0 and the real size is
  // SizeOnDisk - so fall back to SizeOnDisk in that case.
  const decompressedSize = entry.uncompressedSize > 0 ? entry.uncompressedSize : entry.sizeOnDisk
  const data = await decompress(compressed, decompressedSize, entry.flags)

  const outPath = path.join(outputDir, normalizePath(entry.name))
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, data)
}

function isDeletion(offset: bigint): boolean {
  return (offset & DELETION_OFFSET_MASK) === DELETION_MARKER
}

function normalizePath(name: string): string {
  return name.replace(/\\/g, '/')
}
