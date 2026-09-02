import { NEXUS_FILE_NAME_MAX_LENGTH } from './nexus.constants'
import type { NexusModFile, NexusModFileVersion, NexusModFileVersionsResponse } from './nexus.types'
import { NexusApiError } from './nexus-errors'

export interface ModFileWithLatestVersion {
  file: NexusModFile
  latestVersion: NexusModFileVersion | null
}

/**
 * Finds a mod file by its exact, case-insensitive name.
 * The name is the stable handle for "Icosa - Translation Tool - Portable" etc.,
 * since mod file ids are opaque.
 */
export function findModFileByName(
  modFiles: NexusModFile[],
  name: string
): NexusModFile | undefined {
  const target = name.trim().toLowerCase()
  return modFiles.find((file) => file.name.trim().toLowerCase() === target)
}

/**
 * Finds the mod file whose latest version carries the given name. Used when
 * the mod file itself still has a legacy display name but its current version
 * already follows the canonical naming ("Icosa - Translation Tool - Portable").
 */
export async function findModFileByLatestVersionName(
  api: {
    getModFileVersions(modFileId: string): Promise<NexusModFileVersionsResponse>
  },
  modFiles: NexusModFile[],
  name: string
): Promise<{ file: NexusModFile; latest: NexusModFileVersion | null } | undefined> {
  const target = name.trim().toLowerCase()
  for (const file of modFiles) {
    const latest = await resolveLatestVersion(api, file.id)
    if (latest && latest.name.trim().toLowerCase() === target) {
      return { file, latest }
    }
  }
  return undefined
}

/**
 * Resolves the most recent version of a mod file so a new upload can chain
 * from it via previous_version_id (keeps the update-group lineage intact).
 */
export async function resolveLatestVersion(
  api: {
    getModFileVersions(modFileId: string): Promise<NexusModFileVersionsResponse>
  },
  modFileId: string
): Promise<NexusModFileVersion | null> {
  const { data } = await api.getModFileVersions(modFileId)
  const versions = data.versions
  if (versions.length === 0) return null
  const sorted = [...versions].sort((a, b) => {
    const pa = Number.parseFloat(a.position) || 0
    const pb = Number.parseFloat(b.position) || 0
    if (pa !== pb) return pb - pa
    return Date.parse(b.uploaded_at) - Date.parse(a.uploaded_at)
  })
  return sorted[0]
}

export function assertFileName(name: string): void {
  if (name.length > NEXUS_FILE_NAME_MAX_LENGTH) {
    throw new NexusApiError(
      0,
      `Mod file name exceeds ${NEXUS_FILE_NAME_MAX_LENGTH} characters: "${name}"`
    )
  }
  if (!/^[a-zA-Z0-9 _'().-]+$/.test(name)) {
    throw new NexusApiError(0, `Mod file name has unsupported characters: "${name}"`)
  }
}
