import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { Worker } from 'node:worker_threads'
import { eq } from 'drizzle-orm'
import { app } from 'electron'
import type { RepositoryRegistry } from '../database/repositories/registry'
import { config } from '../database/schema'
import { cleanupTempDir, createTempDir } from '../utils/tempDir'
import { resolveWorkerPath } from '../utils/worker-path'
import type { PrepareInputProgress } from '../workers/prepare-input.worker.runtime'
import { writeLocaFile } from './loca/loca-writer'
import {
  inspectXmlCandidate,
  type TranslationXmlCandidate,
  type UnpackedLocalizationPackage,
  type UnpackLocalizationProgress
} from './localization-package'
import { packMod } from './lslib.service'
import {
  calculateVersion64,
  formatVersion,
  isValidMetaFolder,
  type MetaInfo,
  parseVersionString,
  readMetaInfo,
  sanitizeMetaFolder,
  writeMeta
} from './lsx-parser.service'
import { decodeEntities, encodeEntities } from './xml-entities.service'
import {
  type LocalizationEntry,
  parseLocalizationFile,
  writeLocalizationXml
} from './xml-parser.service'
import { createZip } from './zip.service'

export type { TranslationXmlCandidate }

export interface PreparedTranslationInput {
  importId: string
  requiresSelection: boolean
  candidates: TranslationXmlCandidate[]
}

export interface CompleteTranslationImportResult {
  xmlPath: string
  meta: MetaInfo
  // mod_source ids keyed by lowercase original file name.
  sourceFileIds: Record<string, number>
}

export interface ExportPackagePayload {
  outputPath: string
  format: 'pak' | 'zip'
  modName: string
  entries: ExportPackageEntry[]
  meta: MetaInfo
  bg3LanguageFolder: string
  // 'xml' (default, engine-verified) or 'loca' (binary; file named as the language).
  exportFileType?: 'xml' | 'loca'
  // When true, entries are grouped back into their ORIGINAL files (mod_source) instead
  // of one merged file. Falls back to a single file when the split is unknown.
  preserveSourceFiles?: boolean
  // uid -> original file name (lowercased key) resolved by the caller from the session.
  entrySourceFiles?: Record<string, string>
}

export interface ExportPackageEntry {
  uid: string
  version: string
  source: string
  target: string
  sourceFile?: string | null
  sourceFileType?: 'xml' | 'loca' | null
}

interface StagedImport {
  inputPath: string
  tempDirs: string[]
  candidates: TranslationXmlCandidate[]
  metaPath: string | null
}

const stagedImports = new Map<string, StagedImport>()

const PREPARE_CANCELLED = 'PREPARE_CANCELLED'
const MAX_CONCURRENT_UNPACKS = 2

export function isPrepareCancelled(error: unknown): boolean {
  return error instanceof Error && error.message === PREPARE_CANCELLED
}

interface UnpackJob {
  jobId: string
  inputPath: string
  tempDir: string
  onProgress?: (p: UnpackLocalizationProgress) => void
  resolve: (value: UnpackedLocalizationPackage) => void
  reject: (error: Error) => void
  worker: Worker | null
  cancelled: boolean
  running: boolean
}

const unpackJobs = new Map<string, UnpackJob>()
const unpackQueue: string[] = []
let unpackRunning = 0

export async function prepareTranslationInput(
  inputPath: string,
  onProgress?: (p: UnpackLocalizationProgress) => void,
  jobId?: string
): Promise<PreparedTranslationInput> {
  const unpackJobId = jobId ?? randomUUID()
  const ext = path.extname(inputPath).toLowerCase()
  const importId = randomUUID()

  if (ext === '.xml' || ext === '.loca') {
    const candidate = inspectXmlCandidate(inputPath, inputPath, 'direct')
    stagedImports.set(importId, {
      inputPath,
      tempDirs: [],
      candidates: [candidate],
      metaPath: null
    })
    return { importId, requiresSelection: false, candidates: [candidate] }
  }

  const unpacked = await unpackPackageViaWorker(inputPath, onProgress, unpackJobId)
  stagedImports.set(importId, {
    inputPath,
    tempDirs: [unpacked.tempDir],
    candidates: unpacked.candidates,
    metaPath: unpacked.metaPath
  })
  return { importId, requiresSelection: true, candidates: unpacked.candidates }
}

export function cancelUnpackJob(jobId: string): void {
  const job = unpackJobs.get(jobId)
  if (!job) return
  job.cancelled = true
  const queuedAt = unpackQueue.indexOf(jobId)
  if (queuedAt >= 0) unpackQueue.splice(queuedAt, 1)
  if (job.worker) {
    void job.worker.terminate()
    job.worker = null
  }
  cleanupTempDir(job.tempDir)
  settleUnpackJob(job, () => job.reject(new Error(PREPARE_CANCELLED)))
}

function unpackPackageViaWorker(
  inputPath: string,
  onProgress: ((p: UnpackLocalizationProgress) => void) | undefined,
  jobId: string
): Promise<UnpackedLocalizationPackage> {
  const tempDir = createTempDir('icosa_import')
  fs.mkdirSync(tempDir, { recursive: true })

  return new Promise((resolve, reject) => {
    const existing = unpackJobs.get(jobId)
    if (existing) {
      cancelUnpackJob(jobId)
    }

    const job: UnpackJob = {
      jobId,
      inputPath,
      tempDir,
      onProgress,
      resolve,
      reject,
      worker: null,
      cancelled: false,
      running: false
    }
    unpackJobs.set(jobId, job)
    unpackQueue.push(jobId)
    pumpUnpackQueue()
  })
}

function pumpUnpackQueue(): void {
  while (unpackRunning < MAX_CONCURRENT_UNPACKS && unpackQueue.length > 0) {
    const jobId = unpackQueue.shift()
    if (!jobId) break
    const job = unpackJobs.get(jobId)
    if (!job || job.cancelled) continue
    startUnpackWorker(job)
  }
}

function startUnpackWorker(job: UnpackJob): void {
  unpackRunning += 1
  job.running = true
  const worker = new Worker(resolveWorkerPath(__dirname, 'prepare-input.worker.js'), {
    workerData: { inputPath: job.inputPath, tempDir: job.tempDir }
  })
  job.worker = worker

  worker.on('message', (msg: PrepareInputProgress) => {
    if (job.cancelled) return
    if (msg.phase === 'done') {
      settleUnpackJob(job, () => job.resolve(msg.result))
      return
    }
    if (msg.phase === 'error') {
      cleanupTempDir(job.tempDir)
      settleUnpackJob(job, () => job.reject(new Error(msg.message)))
      return
    }
    job.onProgress?.(msg)
  })

  worker.on('error', (error) => {
    if (job.cancelled) return
    cleanupTempDir(job.tempDir)
    settleUnpackJob(job, () => job.reject(error))
  })

  worker.on('exit', (code) => {
    if (job.cancelled || !unpackJobs.has(job.jobId)) return
    if (code !== 0) {
      cleanupTempDir(job.tempDir)
      settleUnpackJob(job, () =>
        job.reject(new Error(`prepare-input worker exited with code ${code}`))
      )
    }
  })
}

function settleUnpackJob(job: UnpackJob, settle: () => void): void {
  if (!unpackJobs.has(job.jobId)) return
  unpackJobs.delete(job.jobId)
  if (job.running) {
    job.running = false
    unpackRunning = Math.max(0, unpackRunning - 1)
  }
  settle()
  pumpUnpackQueue()
}

export function getStagedCandidate(
  importId: string,
  candidateId: string
): TranslationXmlCandidate | undefined {
  const staged = stagedImports.get(importId)
  if (!staged) return undefined
  return staged.candidates.find((candidate) => candidate.id === candidateId)
}

/**
 * Resolves multiple staged candidates preserving the caller's selection order.
 * Returns an empty array when the session expired or no id matches.
 */
export function getStagedCandidates(
  importId: string,
  candidateIds: string[]
): TranslationXmlCandidate[] {
  const staged = stagedImports.get(importId)
  if (!staged) return []
  const byId = new Map(staged.candidates.map((candidate) => [candidate.id, candidate]))
  const resolved: TranslationXmlCandidate[] = []
  const seen = new Set<string>()
  for (const id of candidateIds) {
    if (seen.has(id)) continue
    seen.add(id)
    const candidate = byId.get(id)
    if (candidate) resolved.push(candidate)
  }
  return resolved
}

export function discardTranslationInput(importId: string): void {
  const staged = stagedImports.get(importId)
  if (!staged) return
  stagedImports.delete(importId)
  for (const dir of staged.tempDirs) cleanupTempDir(dir)
}

export function completeTranslationImport(
  repos: RepositoryRegistry,
  params: {
    importId: string
    candidateIds: string[]
    modName: string
    targetLang: string
  }
): CompleteTranslationImportResult {
  const staged = stagedImports.get(params.importId)
  if (!staged) throw new Error('Import session expired. Select the file again.')

  const requestedIds = new Set(params.candidateIds)
  if (requestedIds.size === 0) throw new Error('No valid XML found')

  const candidates = staged.candidates.filter((candidate) => requestedIds.has(candidate.id))
  if (candidates.length !== requestedIds.size) throw new Error('Selected XML was not found')
  if (candidates.some((candidate) => !candidate.valid)) {
    throw new Error('Selected XML has an invalid format')
  }
  // UI tabs already enforce one-format-per-import; this guards direct IPC calls.
  // Same strings in .xml and .loca would create duplicate dictionary entries.
  const fileTypes = new Set(candidates.map((candidate) => candidate.fileType))
  if (fileTypes.size > 1) {
    throw new Error('Selected files mix XML and LOCA formats')
  }

  const modDir = getStoredModDir(params.modName)
  fs.mkdirSync(modDir, { recursive: true })

  // Merge keeps per-file identity: each entry carries its original file so the
  // import session can register one mod_source row per selected file (original
  // names). Renamed-file re-imports reuse the same mod_source row (unique
  // (mod_id, file_name)); dictionary UIDs are NOT duplicated.
  const mergedEntries: { entry: LocalizationEntry; fileName: string; isLoca: boolean }[] =
    candidates.flatMap((candidate) => {
      const isLoca = candidate.fileType === 'loca'
      return parseLocalizationFile(candidate.absolutePath).map((entry) => ({
        entry,
        fileName: path.basename(candidate.absolutePath),
        isLoca
      }))
    })
  // Group by file name to dedupe mod_source lookups (importants: same file selected
  // twice across candidates lands in one mod_source row).
  const fileNamesInOrder: string[] = []
  const fileTypesByName = new Map<string, 'xml' | 'loca'>()
  for (const item of mergedEntries) {
    const key = item.fileName.toLowerCase()
    if (!fileTypesByName.has(key)) {
      fileNamesInOrder.push(item.fileName)
      fileTypesByName.set(key, item.isLoca ? 'loca' : 'xml')
    }
  }
  const sourceFileIds = new Map<string, number>()
  for (const fileName of fileNamesInOrder) {
    sourceFileIds.set(
      fileName.toLowerCase(),
      repos.sourceFile.getOrCreate(
        params.modName,
        fileName,
        fileTypesByName.get(fileName.toLowerCase()) ?? 'xml'
      )
    )
  }

  const mergedXmlEntries = mergedEntries.map(({ entry }) => entry)
  // Multi-file imports used to be stored as a fixed 'translation_merged.xml'.
  // Name the merged file after the real content: single file keeps its own name;
  // multiple files use "<first file>_merged.xml" so the lineage stays visible.
  const storedName =
    fileNamesInOrder.length > 1
      ? `${fileNamesInOrder[0].replace(/\.(xml|loca)$/i, '')}_merged.xml`
      : (fileNamesInOrder[0] ?? `${sanitizeStoredModName(params.modName)}.xml`)
  const xmlPath = path.join(modDir, storedName)
  writeLocalizationXml(mergedXmlEntries, xmlPath)
  // Keep per-file identity for the merged session: write a side map so the
  // xml-load worker can restore the original file name per entry. This keeps
  // the grid column and per-file export correct without keeping N separate
  // files or extra DB lookups per entry.
  const sourceMapPath = path.join(modDir, 'translation_source_map.json')
  if (fileNamesInOrder.length > 1) {
    const map = mergedEntries.map((item) => item.fileName)
    fs.writeFileSync(sourceMapPath, JSON.stringify(map), 'utf-8')
  } else {
    try {
      fs.unlinkSync(sourceMapPath)
    } catch {}
  }

  repos.mod.upsert(params.modName, {
    totalStrings: mergedXmlEntries.length,
    lastFilePath: xmlPath
  })

  const meta = buildDefaultMeta(repos, {
    modName: params.modName,
    targetLang: params.targetLang,
    sourceMetaPath: staged.metaPath,
    outputPath: path.join(modDir, 'meta.lsx')
  })
  const savedMeta = repos.modMeta.upsertForModName(params.modName, meta)

  const result: CompleteTranslationImportResult & { sourceFileIds: Record<string, number> } = {
    xmlPath,
    meta: savedMeta,
    sourceFileIds: Object.fromEntries(sourceFileIds)
  }

  discardTranslationInput(params.importId)
  return result
}

export function getMetaForMod(
  repos: RepositoryRegistry,
  params: { modName: string; targetLang: string }
): MetaInfo {
  const existing = repos.modMeta.findByModName(params.modName)
  if (existing) return existing

  return buildDefaultMeta(repos, {
    modName: params.modName,
    targetLang: params.targetLang,
    outputPath: path.join(getStoredModDir(params.modName), 'meta.lsx')
  })
}

export function upsertMetaForMod(
  repos: RepositoryRegistry,
  modName: string,
  input: MetaInfo
): MetaInfo {
  validateMetaInput(input)
  repos.mod.upsert(modName)
  const version = {
    major: input.versionMajor,
    minor: input.versionMinor,
    revision: input.versionRevision,
    build: input.versionBuild
  }
  const meta = writeMeta({
    sourcePath: input.metaFilePath,
    outputPath: input.metaFilePath,
    name: input.name,
    folder: input.folder,
    author: input.author,
    description: input.description,
    uuid: input.uuid,
    version,
    version64: calculateVersion64(version)
  })
  return repos.modMeta.upsertForModName(modName, meta)
}

export async function exportTranslatedPackage(
  repos: RepositoryRegistry,
  payload: ExportPackagePayload
): Promise<{ outputPath: string }> {
  const meta = upsertMetaForMod(repos, payload.modName, payload.meta)
  if (!/^[a-zA-Z0-9]+$/.test(payload.bg3LanguageFolder)) {
    throw new Error('BG3 language folder must not contain spaces or special characters')
  }
  const exportFileType = payload.exportFileType ?? 'xml'

  const tempDir = createTempDir('icosa_export')
  fs.mkdirSync(tempDir, { recursive: true })

  try {
    const packageRoot = path.join(tempDir, meta.folder)
    const modRoot = path.join(packageRoot, 'Mods', meta.folder)
    const localizationDir = path.join(modRoot, 'Localization', payload.bg3LanguageFolder)
    const exportMetaPath = path.join(modRoot, 'meta.lsx')

    // Group entries back into their original files when the split is known and wanted.
    const groups = groupEntriesForExport(repos, payload, meta)

    if (exportFileType === 'loca') {
      // Binary .loca: the game only loads add-on binary locas when the file is named
      // as the language (vanilla convention, lowercase) - one file regardless of the
      // original split. Markup must be stored raw (LocaXML keeps it entity-escaped).
      writeLocaFile(
        payload.entries.map((entry) => ({
          key: entry.uid,
          version: Number.parseInt(entry.version, 10) || 1,
          text: decodeEntities(entry.target || entry.source)
        })),
        path.join(localizationDir, `${payload.bg3LanguageFolder.toLowerCase()}.loca`)
      )
    } else {
      for (const group of groups) {
        const locEntries = group.entries.map((entry) => ({
          contentuid: entry.uid,
          version: entry.version,
          text: encodeEntities(entry.target || entry.source)
        }))
        // pak/zip with xml must always be .xml even if the source was .loca
        const outName = group.fileName.toLowerCase().endsWith('.loca')
          ? group.fileName.replace(/\.loca$/i, '.xml')
          : group.fileName
        writeLocalizationXml(locEntries, path.join(localizationDir, outName))
      }
    }

    writeMeta({
      sourcePath: meta.metaFilePath,
      outputPath: exportMetaPath,
      name: meta.name,
      folder: meta.folder,
      author: meta.author,
      description: meta.description,
      uuid: meta.uuid,
      version: {
        major: meta.versionMajor,
        minor: meta.versionMinor,
        revision: meta.versionRevision,
        build: meta.versionBuild
      },
      version64: meta.version64
    })

    const pakOutput =
      payload.format === 'pak'
        ? payload.outputPath
        : path.join(tempDir, 'zipRoot', `${meta.folder}.pak`)
    fs.mkdirSync(path.dirname(pakOutput), { recursive: true })
    await packMod(packageRoot, pakOutput)

    if (payload.format === 'zip') {
      createZip(path.dirname(pakOutput), payload.outputPath)
    }

    return { outputPath: payload.outputPath }
  } finally {
    cleanupTempDir(tempDir)
  }
}

interface ExportFileGroup {
  fileName: string
  entries: ExportPackageEntry[]
}

// Resolve the on-disk file grouping for this export:
// 1. per-entry sourceFile from the live session (authoritative for what the user sees);
// 2. fallback: mod_source grouping from the dictionary (rows saved earlier);
// 3. fallback: single file with the original merged name / language name.
function groupEntriesForExport(
  repos: RepositoryRegistry,
  payload: ExportPackagePayload,
  meta: MetaInfo
): ExportFileGroup[] {
  const { entries } = payload
  const preserve = payload.preserveSourceFiles ?? true

  const byLowerName = new Map<string, ExportFileGroup>()
  const order: string[] = []
  const unfiled: ExportPackageEntry[] = []

  for (const entry of entries) {
    const rawName = entry.sourceFile?.trim()
    if (preserve && rawName && /^[^\\/]+\.(xml|loca)$/i.test(rawName)) {
      const key = rawName.toLowerCase()
      let group = byLowerName.get(key)
      if (!group) {
        group = { fileName: rawName, entries: [] }
        byLowerName.set(key, group)
        order.push(rawName)
      }
      group.entries.push(entry)
    } else {
      unfiled.push(entry)
    }
  }

  if (byLowerName.size === 0 || unfiled.length === entries.length) {
    // No per-file info (legacy session / single import): one file.
    if (payload.exportFileType === 'loca') {
      return [
        {
          fileName: `${payload.bg3LanguageFolder.toLowerCase()}.loca`,
          entries
        }
      ]
    }
    return [{ fileName: readOriginalXmlName(repos, payload.modName, meta.folder), entries }]
  }

  // Entries without file info ride along in the first group so nothing is silently
  // dropped from the export.
  if (unfiled.length > 0) {
    const first = order[0]
    const target = first ? byLowerName.get(first.toLowerCase()) : undefined
    if (target) target.entries.push(...unfiled)
    else {
      const mergedName = readOriginalXmlName(repos, payload.modName, meta.folder)
      byLowerName.set(mergedName.toLowerCase(), { fileName: mergedName, entries: unfiled })
      order.push(mergedName)
    }
  }

  return order.map((name) => byLowerName.get(name.toLowerCase()) as ExportFileGroup)
}

function buildDefaultMeta(
  repos: RepositoryRegistry,
  params: {
    modName: string
    targetLang: string
    outputPath: string
    sourceMetaPath?: string | null
  }
): MetaInfo {
  const targetLanguage = repos.language.findByCode(params.targetLang)
  const targetName = targetLanguage?.name ?? params.targetLang
  const targetSuffix = params.targetLang.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  const defaultName = `${params.modName} ${targetSuffix}`.trim()
  const defaultFolder = sanitizeMetaFolder(defaultName)
  const original =
    params.sourceMetaPath && fs.existsSync(params.sourceMetaPath)
      ? readMetaInfo(params.sourceMetaPath)
      : null
  const version = original
    ? {
        major: original.versionMajor,
        minor: original.versionMinor,
        revision: original.versionRevision,
        build: original.versionBuild
      }
    : { major: 1, minor: 0, revision: 0, build: 1 }
  const version64 = original?.version64 ?? calculateVersion64(version)

  return writeMeta({
    sourcePath: params.sourceMetaPath ?? undefined,
    outputPath: params.outputPath,
    name: defaultName,
    folder: defaultFolder,
    author: readDefaultAuthor(repos),
    description: `${targetName} Translation`,
    uuid: randomUUID(),
    version,
    version64
  })
}

function validateMetaInput(meta: MetaInfo): void {
  if (!isValidMetaFolder(meta.folder)) {
    throw new Error('Folder must contain only letters, numbers, underscores, or hyphens')
  }
  const versionText = formatVersion({
    major: meta.versionMajor,
    minor: meta.versionMinor,
    revision: meta.versionRevision,
    build: meta.versionBuild
  })
  parseVersionString(versionText)
}

function readDefaultAuthor(repos: RepositoryRegistry): string {
  const row = repos.db.select().from(config).where(eq(config.key, 'author')).get() as
    | { value: string | null }
    | undefined
  return row?.value?.trim() || 'Icosa'
}

function readOriginalXmlName(
  repos: RepositoryRegistry,
  modName: string,
  fallbackFolder: string
): string {
  const lastFilePath = repos.mod.findByName(modName)?.lastFilePath
  const fileName = lastFilePath ? path.basename(lastFilePath) : ''
  return fileName.toLowerCase().endsWith('.xml') ? fileName : `${fallbackFolder}.xml`
}

export function getStoredModDir(modName: string): string {
  return path.join(app.getPath('userData'), 'icosa', 'mods', sanitizeStoredModName(modName))
}

function sanitizeStoredModName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
}
