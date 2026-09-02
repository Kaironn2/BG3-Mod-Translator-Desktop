import type {
  NexusCreateMultipartUploadResponse,
  NexusCreateUploadInput,
  NexusCreateUploadResponse,
  NexusCreateVersionInput,
  NexusCreateVersionSuccess,
  NexusModFileVersion,
  NexusModFileVersionsResponse,
  NexusModFilesResponse,
  NexusModResponse,
  NexusUpload
} from './nexus.types'
import type { NexusClient } from './nexus-client'

/**
 * Thin, endpoint-shaped API layer over NexusClient.
 * All methods are read/write against the documented v3 REST surface; nothing
 * here knows about Icosa release conventions.
 */
export class NexusApi {
  constructor(public readonly client: NexusClient) {}

  async getMod(gameDomain: string, gameScopedId: string): Promise<NexusModResponse> {
    return this.client.get<NexusModResponse>(
      `/games/${encodeURIComponent(gameDomain)}/mods/${encodeURIComponent(gameScopedId)}`
    )
  }

  async getModFiles(modId: string): Promise<NexusModFilesResponse> {
    return this.client.get<NexusModFilesResponse>(`/mods/${encodeURIComponent(modId)}/files`)
  }

  async getModFileVersions(modFileId: string): Promise<NexusModFileVersionsResponse> {
    return this.client.get<NexusModFileVersionsResponse>(
      `/mod-files/${encodeURIComponent(modFileId)}/versions`
    )
  }

  async getModFileVersion(versionId: string): Promise<{ data: NexusModFileVersion }> {
    return this.client.get<{ data: NexusModFileVersion }>(
      `/mod-file-versions/${encodeURIComponent(versionId)}`
    )
  }

  async getUpload(uploadId: string): Promise<{ data: NexusUpload }> {
    return this.client.get<{ data: NexusUpload }>(`/uploads/${encodeURIComponent(uploadId)}`)
  }

  async createUpload(input: NexusCreateUploadInput): Promise<NexusCreateUploadResponse> {
    return this.client.postJson<NexusCreateUploadResponse>('/uploads', {
      size_bytes: input.sizeBytes,
      filename: input.filename,
      ...(input.md5 ? { md5: input.md5 } : {})
    })
  }

  async createMultipartUpload(input: NexusCreateUploadInput): Promise<NexusCreateMultipartUploadResponse> {
    return this.client.postJson<NexusCreateMultipartUploadResponse>('/uploads/multipart', {
      size_bytes: input.sizeBytes,
      filename: input.filename,
      ...(input.md5 ? { md5: input.md5 } : {})
    })
  }

  /**
   * Posts the S3 multipart-complete XML to the presigned completion URL.
   * The body is XML (not JSON), so it goes through putBytes-style raw request.
   */
  async completeMultipartUpload(completePresignedUrl: string, xml: string): Promise<void> {
    await this.client.putBytes(
      completePresignedUrl,
      Buffer.from(xml, 'utf-8'),
      { 'Content-Type': 'application/xml', 'Content-Length': String(Buffer.byteLength(xml, 'utf-8')) }
    )
  }

  async finaliseUpload(uploadId: string): Promise<void> {
    await this.client.postVoid(`/uploads/${encodeURIComponent(uploadId)}/finalise`)
  }

  async createModFileVersion(
    modFileId: string,
    input: NexusCreateVersionInput
  ): Promise<NexusCreateVersionSuccess> {
    return this.client.postJson<NexusCreateVersionSuccess>(
      `/mod-files/${encodeURIComponent(modFileId)}/versions`,
      {
        upload_id: input.uploadId,
        name: input.name,
        version: input.version,
        description: input.description ?? null,
        file_category: input.fileCategory,
        primary_mod_manager_download: input.primaryModManagerDownload ?? false,
        allow_mod_manager_download: input.allowModManagerDownload ?? true,
        show_requirements_pop_up: input.showRequirementsPopUp ?? false,
        update_mod_version: input.updateModVersion ?? false,
        archive_existing_file: input.archiveExistingFile ?? false,
        previous_version_id: input.previousVersionId ?? null
      }
    )
  }
}
