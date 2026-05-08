// Binary layout constants for the BG3 .pak (LSPK) container format, version 18.
// Mirrors LSLib/LS/PackageFormat.cs (LSPKHeader16, FileEntry18) and LSLib/LS/Enums/Compression.cs.

export const LSPK_SIGNATURE = 0x4b50534c
export const LSPK_VERSION_BG3 = 18

// LSPKHeader16 layout (Pack=1), excluding the 4-byte LSPK signature that precedes it.
// Field order: Version u32, FileListOffset u64, FileListSize u32, Flags u8, Priority u8, Md5[16], NumParts u16.
export const HEADER_SIZE = 4 + 8 + 4 + 1 + 1 + 16 + 2 // = 36

// 4 bytes signature + header.
export const HEADER_TOTAL_SIZE = 4 + HEADER_SIZE // = 40

// FileEntry18 layout (Pack=1):
// Name[256], OffsetInFile1 u32, OffsetInFile2 u16, ArchivePart u8, Flags u8, SizeOnDisk u32, UncompressedSize u32.
export const FILE_ENTRY_SIZE = 256 + 4 + 2 + 1 + 1 + 4 + 4 // = 272
export const FILE_NAME_BYTES = 256

// V18 padding between consecutive file blobs is aligned to 64-byte boundaries
// relative to the start of the data area (which is right after the 40-byte header).
export const V18_PADDING_SIZE = 0x40
export const V18_PADDING_BYTE = 0xad

export const enum PackageFlags {
  None = 0,
  AllowMemoryMapping = 0x02,
  Solid = 0x04,
  Preload = 0x08,
}

// Bits 0-3 of the per-file Flags byte.
export const enum CompressionMethod {
  None = 0,
  Zlib = 1,
  LZ4 = 2,
  Zstd = 3,
}

// Bits 4-7 of the per-file Flags byte.
export const enum CompressionLevelFlag {
  Fast = 0x10,
  Default = 0x20,
  Max = 0x40,
}

export const enum CompressionLevel {
  Fast = 0,
  Default = 1,
  Max = 2,
}

export interface PackageHeader {
  version: number
  fileListOffset: bigint
  fileListSize: number
  flags: number
  priority: number
  md5: Buffer
  numParts: number
}

export interface FileEntry {
  name: string
  offsetInFile: bigint
  archivePart: number
  flags: number
  sizeOnDisk: number
  uncompressedSize: number
}

export function getCompressionMethod(flags: number): CompressionMethod {
  return (flags & 0x0f) as CompressionMethod
}

export function getCompressionLevel(flags: number): CompressionLevel {
  switch (flags & 0xf0) {
    case CompressionLevelFlag.Fast:
      return CompressionLevel.Fast
    case CompressionLevelFlag.Max:
      return CompressionLevel.Max
    default:
      return CompressionLevel.Default
  }
}

export function makeCompressionFlags(method: CompressionMethod, level: CompressionLevel): number {
  if (method === CompressionMethod.None) return 0
  const levelBits =
    level === CompressionLevel.Fast
      ? CompressionLevelFlag.Fast
      : level === CompressionLevel.Max
        ? CompressionLevelFlag.Max
        : CompressionLevelFlag.Default
  return method | levelBits
}

// Files with these extensions are never compressed (matches LSLib PackageWriter.CanCompressFile).
const NON_COMPRESSIBLE_EXTENSIONS = new Set(['.gts', '.gtp', '.wem', '.bnk', '.bk2'])

export function shouldCompress(filename: string, byteLength: number): boolean {
  if (byteLength === 0) return false
  const dot = filename.lastIndexOf('.')
  if (dot < 0) return true
  const ext = filename.slice(dot).toLowerCase()
  return !NON_COMPRESSIBLE_EXTENSIONS.has(ext)
}
