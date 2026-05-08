// Compression/decompression bridge for the .pak codecs (None, Zlib, LZ4, Zstd).
//
// LSLib uses raw LZ4 block format (no size prefix) for both the file table and per-file blobs.
// `lz4-napi` exposes only the size-prefixed variant from lz4-flex (compress_prepend_size /
// decompress_size_prepended), so we strip/prepend a 4-byte little-endian uncompressed-size
// header to bridge the two formats. This is a one-line transform on each side and is
// binary-compatible with K4os.LZ4Codec output.
//
// Zstd is decompress-only via the pure-JS `fzstd` library: the BG3 modding workflow never
// produces zstd-compressed .pak files (default is LZ4HC), and zstd-compressed entries inside
// existing mods are rare. Pure JS is acceptable here since the hot path is LZ4.

import { decompress as fzstdDecompress } from 'fzstd'
import { compress as lz4Compress, uncompress as lz4Uncompress } from 'lz4-napi'
import { promisify } from 'util'
import zlib from 'zlib'

import {
  CompressionLevel,
  CompressionMethod,
  getCompressionMethod,
  getCompressionLevel,
} from './pak-format'

const inflateAsync = promisify(zlib.inflate)
const deflateAsync = promisify(zlib.deflate)

export async function decompress(
  buf: Buffer,
  uncompressedSize: number,
  flags: number,
): Promise<Buffer> {
  const method = getCompressionMethod(flags)
  switch (method) {
    case CompressionMethod.None:
      return buf
    case CompressionMethod.Zlib:
      return inflateAsync(buf)
    case CompressionMethod.LZ4:
      return decompressLz4Block(buf, uncompressedSize)
    case CompressionMethod.Zstd: {
      const out = fzstdDecompress(buf)
      return Buffer.from(out.buffer, out.byteOffset, out.byteLength)
    }
    default:
      throw new Error(`Unsupported compression method: ${method}`)
  }
}

export async function compress(
  buf: Buffer,
  method: CompressionMethod,
  level: CompressionLevel,
): Promise<Buffer> {
  switch (method) {
    case CompressionMethod.None:
      return buf
    case CompressionMethod.Zlib:
      return deflateAsync(buf, { level: zlibLevel(level) })
    case CompressionMethod.LZ4:
      return compressLz4Block(buf)
    case CompressionMethod.Zstd:
      throw new Error(
        'Zstd compression is not supported when writing .pak files (decode-only). Use LZ4 instead.',
      )
    default:
      throw new Error(`Unsupported compression method: ${method}`)
  }
}

// Compress raw LZ4 block: lz4-napi prepends a 4-byte LE size header — strip it.
async function compressLz4Block(buf: Buffer): Promise<Buffer> {
  if (buf.length === 0) return Buffer.alloc(0)
  const prefixed = await lz4Compress(buf)
  return prefixed.subarray(4)
}

// Decompress raw LZ4 block: prepend the 4-byte LE size header that lz4-napi expects.
async function decompressLz4Block(buf: Buffer, uncompressedSize: number): Promise<Buffer> {
  if (uncompressedSize === 0) return Buffer.alloc(0)
  const prefixed = Buffer.alloc(buf.length + 4)
  prefixed.writeUInt32LE(uncompressedSize, 0)
  buf.copy(prefixed, 4)
  return lz4Uncompress(prefixed)
}

function zlibLevel(level: CompressionLevel): number {
  switch (level) {
    case CompressionLevel.Fast:
      return zlib.constants.Z_BEST_SPEED
    case CompressionLevel.Max:
      return zlib.constants.Z_BEST_COMPRESSION
    default:
      return zlib.constants.Z_DEFAULT_COMPRESSION
  }
}

// Re-export so callers can import everything from one place.
export { CompressionLevel, CompressionMethod, getCompressionLevel, getCompressionMethod }
