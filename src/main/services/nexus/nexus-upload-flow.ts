import type { NexusApi } from './nexus.api'
import { fileSizeBytes, md5HexOfFile, uploadFileToPresignedUrl } from './nexus-upload'

/**
 * Upload-session helpers shared by release flows. Kept separate from
 * icosa-release.service so other future flows (translation packs) reuse them.
 */
export async function createUpload(
  api: NexusApi,
  filePath: string,
  filename: string
): Promise<string> {
  const [size, md5] = await Promise.all([fileSizeBytes(filePath), md5HexOfFile(filePath)])
  const response = await api.createUpload({ sizeBytes: size, filename, md5 })
  return response.id
}

export async function uploadToPresignedUrl(
  api: NexusApi,
  uploadId: string,
  filePath: string,
  filename: string
): Promise<void> {
  const { data } = await api.getUpload(uploadId)
  const withUrl = data as unknown as { presigned_url?: string }
  if (!withUrl.presigned_url) {
    throw new Error(`Upload ${uploadId} has no presigned URL`)
  }
  const md5 = await md5HexOfFile(filePath)
  await uploadFileToPresignedUrl(api.client, withUrl.presigned_url, filePath, filename, md5)
}

export async function finaliseUpload(api: NexusApi, uploadId: string): Promise<void> {
  await api.finaliseUpload(uploadId)
}
