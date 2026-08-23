import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { Worker } from 'node:worker_threads'
import { eq } from 'drizzle-orm'
import { app } from 'electron'
import type { RepositoryRegistry } from '../database/repositories/registry'
import { config } from '../database/schema'
import { cleanupTempDir, createTempDir } from '../utils/tempDir'
import type { PrepareInputProgress } from '../workers/prepare-input.worker.runtime'
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
import { encodeEntities } from './xml-entities.service'
import { parseLocalizationXml, writeLocalizationXml } from './xml-parser.service'
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
}

export interface ExportPackagePayload {
  outputPath: string
  format: 'pak' | 'zip'
  modName: string
  entries: ExportPackageEntry[]
  meta: MetaInfo
  bg3LanguageFolder: string
}

export interface ExportPackageEntry {
  uid: string
  version: string
  source: string
  target: string
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

  if (ext === '.xml') {
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
  const worker = new Worker(path.join(__dirname, 'prepare-input.worker.js'), {
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

  const modDir = getStoredModDir(params.modName)
  fs.mkdirSync(modDir, { recursive: true })

  const mergedEntries = candidates.flatMap((candidate) =>
    parseLocalizationXml(candidate.absolutePath)
  )
  const xmlPath = path.join(modDir, 'translation_merged.xml')
  writeLocalizationXml(mergedEntries, xmlPath)

  repos.mod.upsert(params.modName, {
    totalStrings: mergedEntries.length,
    lastFilePath: xmlPath
  })

  const meta = buildDefaultMeta(repos, {
    modName: params.modName,
    targetLang: params.targetLang,
    sourceMetaPath: staged.metaPath,
    outputPath: path.join(modDir, 'meta.lsx')
  })
  const savedMeta = repos.modMeta.upsertForModName(params.modName, meta)

  discardTranslationInput(params.importId)
  return { xmlPath, meta: savedMeta }
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

  const tempDir = createTempDir('icosa_export')
  fs.mkdirSync(tempDir, { recursive: true })

  try {
    const packageRoot = path.join(tempDir, meta.folder)
    const modRoot = path.join(packageRoot, 'Mods', meta.folder)
    const localizationDir = path.join(modRoot, 'Localization', payload.bg3LanguageFolder)
    const originalXmlName = readOriginalXmlName(repos, payload.modName, meta.folder)
    const exportXmlPath = path.join(localizationDir, originalXmlName)
    const exportMetaPath = path.join(modRoot, 'meta.lsx')

    const locEntries = payload.entries.map((entry) => ({
      contentuid: entry.uid,
      version: entry.version,
      text: encodeEntities(entry.target || entry.source)
    }))
    writeLocalizationXml(locEntries, exportXmlPath)
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
