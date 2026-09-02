/** Mod file: the persistent, updatable entry on a mod page ("Main V3" style). */
export interface NexusModFile {
  id: string
  name: string
  is_active?: boolean
  last_file_uploaded_at?: string | null
  versions_count?: number
  archived_count?: number
  removed_count?: number
}

/** A single version of a mod file (physical file + position in the update chain). */
export interface NexusModFileVersion {
  id: string
  file: NexusModFile
  position: string
  game_scoped_id: string
  name: string
  version: string
  category:
    | 'main'
    | 'update'
    | 'optional'
    | 'old_version'
    | 'miscellaneous'
    | 'removed'
    | 'archived'
    | 'unknown'
  uploaded_at: string
  is_primary?: boolean
}

export interface NexusModFilesResponse {
  data: { mod_files: NexusModFile[] }
}

/** GET /games/{domain}/mods/{game_scoped_id} response. */
export interface NexusModResponse {
  data: {
    id: string
    game_scoped_id: string
    game_id: string
    name: string
  }
}

export interface NexusModFileVersionsResponse {
  data: { versions: NexusModFileVersion[] }
}

export interface NexusUpload {
  id: string
  state: 'created' | 'available'
}

export interface NexusCreateUploadResponse {
  id: string
  state: NexusUpload['state']
  presigned_url: string
}

export interface NexusCreateUploadInput {
  sizeBytes: number
  filename: string
  md5?: string
}

export interface NexusCreateVersionInput {
  uploadId: string
  name: string
  version: string
  description?: string | null
  fileCategory: 'main' | 'optional' | 'miscellaneous'
  primaryModManagerDownload?: boolean
  allowModManagerDownload?: boolean
  showRequirementsPopUp?: boolean
  updateModVersion?: boolean
  archiveExistingFile?: boolean
  previousVersionId?: string | null
}

export interface NexusCreateVersionSuccess {
  file: {
    id: string
    game_scoped_id: string
    name: string
    file_category: string
  }
  version: {
    id: string
    position: string
  }
}
