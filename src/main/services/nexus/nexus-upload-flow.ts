import type { NexusApi } from './nexus.api'
import {
  NEXUS_SINGLE_PART_LIMIT,
  fileSizeBytes,
  md5HexOfFile,
  uploadFileToPresignedUrl,
  uploadMultipart
} from './nexus-upload'

/**
 * Upload-session helpers shared by release flows. Kept separate from
 * icosa-release.service so other future flows (translation packs) reuse them.
 */

/**
 * Stages file bytes for a future mod file version. Files <= 100 MiB use the
 * single-part session; larger ones switch to S3 multipart automatically.
 */
export async function stageUpload(
  api: NexusApi,
  filePath: string,
  filename: string,
  onProgress?: (uploadedBytes: number, totalBytes: number) => void
): Promise<string> {
  const [size, md5] = await Promise.all([fileSizeBytes(filePath), md5HexOfFile(filePath)])

  if (size <= NEXUS_SINGLE_PART_LIMIT) {
    const response = await api.createUpload({ sizeBytes: size, filename, md5 })
    const { data } = await api.getUpload(response.data.id)
    const withUrl = data as unknown as { presigned_url?: string }
    if (!withUrl.presigned_url) throw new Error(`Upload ${response.data.id} has no presigned URL`)
    await uploadFileToPresignedUrl(
      api.client,
      withUrl.presigned_url,
      filePath,
      filename,
      md5,
      onProgress
    )
    return response.data.id
  }

  const multipart = await api.createMultipartUpload({ sizeBytes: size, filename, md5 })
  await uploadMultipart(api.client, {
    partSizeBytes: multipart.data.part_size_bytes,
    partUrls: multipart.data.part_presigned_urls,
    completeUrl: multipart.data.complete_presigned_url,
    filePath,
    filename,
    onProgress
  })
  return multipart.data.id
}

export async function finaliseUpload(api: NexusApi, uploadId: string): Promise<void> {
  await api.finaliseUpload(uploadId)
}