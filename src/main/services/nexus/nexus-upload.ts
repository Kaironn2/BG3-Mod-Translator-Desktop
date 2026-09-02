import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { NexusClient } from './nexus-client'

/** Nexus rejects single-part uploads above this size (100 MiB). */
export const NEXUS_SINGLE_PART_LIMIT = 100 * 1024 * 1024

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

export interface MultipartUploadInput {
  partSizeBytes: number
  partUrls: string[]
  completeUrl: string
  filePath: string
  filename: string
  onProgress?: (uploadedBytes: number, totalBytes: number) => void
}

/**
 * Streams a file to S3 in ordered parts, then posts the multipart-complete XML
 * to the presigned completion URL. Parts upload sequentially: the final part
 * may be smaller than partSizeBytes, all others must match it exactly.
 */
export async function uploadMultipart(
  client: NexusClient,
  input: MultipartUploadInput
): Promise<void> {
  const { open } = await import('node:fs/promises')
  const { total } = { total: (await stat(input.filePath)).size }
  const etags: { partNumber: number; etag: string }[] = []
  const buffer = Buffer.alloc(input.partSizeBytes)
  let uploadedBytes = 0

  for (let partIndex = 0; partIndex < input.partUrls.length; partIndex++) {
    const handle = await open(input.filePath, 'r')
    let read = 0
    try {
      const { bytesRead } = await handle.read(
        buffer,
        0,
        input.partSizeBytes,
        partIndex * input.partSizeBytes
      )
      read = bytesRead
    } finally {
      await handle.close()
    }
    if (read <= 0) throw new Error(`Unexpected empty part ${partIndex + 1}`)

    const partUrl = input.partUrls[partIndex]
    if (!partUrl) throw new Error(`Missing presigned URL for part ${partIndex + 1}`)

    const etag = await putPart(client, partUrl, buffer.subarray(0, read))
    etags.push({ partNumber: partIndex + 1, etag })
    uploadedBytes += read
    input.onProgress?.(uploadedBytes, total)
  }

  const xml = buildCompleteMultipartXml(etags)
  await client.postXml(input.completeUrl, xml)
}

function buildCompleteMultipartXml(parts: { partNumber: number; etag: string }[]): string {
  const body = parts
    .map(
      ({ partNumber, etag }) =>
        `  <Part><PartNumber>${partNumber}</PartNumber><ETag>${etag}</ETag></Part>`
    )
    .join('\n')
  return `<CompleteMultipartUpload>\n${body}\n</CompleteMultipartUpload>`
}

/** PUT one part; the ETag response header is required to complete the upload. */
async function putPart(client: NexusClient, url: string, bytes: Buffer): Promise<string> {
  const { etag } = await client.requestWithResponse<{ etag: string }>({
    method: 'PUT',
    path: url,
    url,
    rawBody: new Uint8Array(bytes),
    skipAuthHeaders: true,
    headers: { 'Content-Length': String(bytes.byteLength) },
    timeoutMs: 30 * 60_000,
    pickHeaders: (headers) => ({ etag: headers.get('etag') ?? '' })
  })
  if (!etag) throw new Error('Multipart part upload returned no ETag')
  return etag.replace(/"/g, '')
}
