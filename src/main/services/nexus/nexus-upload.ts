import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { NexusClient } from './nexus-client'

/**
 * Uploads a local file to a Nexus presigned URL (S3 PUT).
 *
 * Presigned S3 PUT binds two headers into the signature:
 *  - Content-Disposition: attachment; filename="<filename from createUpload>"
 *  - Content-MD5: base64 of the file's MD5 (when md5 was sent at session creation)
 *
 * The whole file is read into memory; release artifacts are ~100 MB zips,
 * which is fine for a build-machine-only workflow.
 */
export async function uploadFileToPresignedUrl(
  client: NexusClient,
  presignedUrl: string,
  filePath: string,
  filename: string,
  md5Hex?: string,
  onProgress?: (uploadedBytes: number, totalBytes: number) => void
): Promise<void> {
  const { readFile } = await import('node:fs/promises')
  const bytes = await readFile(filePath)

  const headers: Record<string, string> = {
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': String(bytes.byteLength)
  }
  if (md5Hex) {
    headers['Content-MD5'] = Buffer.from(md5Hex, 'hex').toString('base64')
  }

  const total = bytes.byteLength
  onProgress?.(0, total)

  await client.putBytes(presignedUrl, bytes, headers)

  onProgress?.(total, total)
}

export function md5HexOfFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('md5')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

export async function fileSizeBytes(filePath: string): Promise<number> {
  const info = await stat(filePath)
  return info.size
}
