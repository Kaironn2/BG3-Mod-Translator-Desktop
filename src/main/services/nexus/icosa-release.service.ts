import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { NexusApi } from './nexus.api'
import {
  ICOSA_INSTALLER_FILE_NAME,
  ICOSA_NEXUS_GAME_SCOPED_ID,
  ICOSA_PORTABLE_FILE_NAME,
  NEXUS_GAME_DOMAIN
} from './nexus.constants'
import { buildFileDescription } from './nexus-description'
import { NexusConfigError } from './nexus-errors'
import {
  assertFileName,
  findModFileByLatestVersionName,
  findModFileByName,
  resolveLatestVersion
} from './nexus-mod-files'

/** One artifact to publish as a new version of an existing mod file. */
export interface NexusReleaseArtifact {
  kind: 'portable' | 'installer'
  /** Absolute path to the .zip to upload. */
  filePath: string
  /** Filename declared in Content-Disposition (informational; Nexus uses the upload filename). */
  uploadFilename: string
}

export interface IcosaNexusReleaseInput {
  version: string
  /** Text from dist/nexus-X.Y.Z; used as-is (line breaks kept, 255-cap enforced). */
  blurb: string
  artifacts: NexusReleaseArtifact[]
  onProgress?: (step: NexusReleaseStep) => void
}

export type NexusReleaseStep =
  | { step: 'resolve-files'; message: string }
  | { step: 'upload'; file: string; message: string }
  | { step: 'finalise'; file: string; message: string }
  | { step: 'create-version'; file: string; message: string }
  | { step: 'done'; message: string }

export interface IcosaNexusReleaseResult {
  version: string
  /** Internal Nexus mod id (not the game-scoped id from the site URL). */
  modId: string
  uploads: Array<{
    kind: 'portable' | 'installer'
    modFileId: string
    modFileName: string
    previousVersionId: string | null
    newVersionId: string
  }>
}

const FILE_KIND_TO_NAME: Record<NexusReleaseArtifact['kind'], string> = {
  portable: ICOSA_PORTABLE_FILE_NAME,
  installer: ICOSA_INSTALLER_FILE_NAME
}

/**
 * Publishes a new Icosa release to Nexus: for each artifact, finds the existing
 * mod file by name, resolves the current latest version, uploads the zip,
 * finalises the session, and creates the new version chained via
 * previous_version_id (archive_existing_file=false, update_mod_version=true).
 */
export async function publishIcosaRelease(
  api: NexusApi,
  input: IcosaNexusReleaseInput
): Promise<IcosaNexusReleaseResult> {
  const version = input.version.trim()
  if (!/^\d+\.\d+\.\d+/.test(version)) {
    throw new NexusConfigError(`Invalid version string: "${version}"`)
  }
  if (input.artifacts.length === 0) {
    throw new NexusConfigError('No artifacts to publish')
  }
  for (const artifact of input.artifacts) {
    assertFileName(FILE_KIND_TO_NAME[artifact.kind])
  }

  input.onProgress?.({
    step: 'resolve-files',
    message: 'Resolving existing Nexus mod files'
  })

  // Endpoints under /mods and /mod-files use the internal id, not the
  // game-scoped id shown in the site URL; resolve it once up front.
  const mod = await api.getMod(NEXUS_GAME_DOMAIN, ICOSA_NEXUS_GAME_SCOPED_ID)
  const modId = mod.data.id

  const { data } = await api.getModFiles(modId)
  const modFiles = data.mod_files

  const uploads: IcosaNexusReleaseResult['uploads'] = []
  for (const artifact of input.artifacts) {
    const targetName = FILE_KIND_TO_NAME[artifact.kind]
    // Prefer the mod file named exactly; fall back to the one whose latest
    // version already carries the canonical name (legacy display names).
    const modFile =
      findModFileByName(modFiles, targetName) ??
      (await findModFileByLatestVersionName(api, modFiles, targetName))?.file
    if (!modFile) {
      throw new NexusConfigError(
        `Mod file "${targetName}" not found on mod ${ICOSA_NEXUS_GAME_SCOPED_ID}. Create it once on the site; this flow only updates existing files.`
      )
    }

    const latest = await resolveLatestVersion(api, modFile.id)
    const previousVersionId = latest && latest.version !== version ? latest.id : null

    input.onProgress?.({
      step: 'upload',
      file: artifact.kind,
      message: `Uploading ${artifact.uploadFilename}`
    })

    const { stageUpload, finaliseUpload } = await import('./nexus-upload-flow')
    const uploadId = await stageUpload(api, artifact.filePath, artifact.uploadFilename)
    await finaliseUpload(api, uploadId)

    input.onProgress?.({
      step: 'create-version',
      file: artifact.kind,
      message: `Creating version ${version} for "${targetName}"`
    })

    const description = buildFileDescription({
      version,
      summary: input.blurb
    })

    const result = await api.createModFileVersion(modFile.id, {
      uploadId,
      name: targetName,
      version,
      description,
      fileCategory: 'main',
      updateModVersion: true,
      archiveExistingFile: false,
      previousVersionId
    })

    uploads.push({
      kind: artifact.kind,
      modFileId: modFile.id,
      modFileName: targetName,
      previousVersionId,
      newVersionId: result.data.version.id
    })
  }

  input.onProgress?.({
    step: 'done',
    message: `Icosa ${version} published to Nexus`
  })

  return { version, modId, uploads }
}

/** Reads dist/nexus-X.Y.Z if present; returns trimmed text or empty string. */
export async function readNexusBlurb(distDir: string, version: string): Promise<string> {
  try {
    const content = await readFile(join(distDir, `nexus-${version}`), 'utf-8')
    return content.trim()
  } catch {
    return ''
  }
}
