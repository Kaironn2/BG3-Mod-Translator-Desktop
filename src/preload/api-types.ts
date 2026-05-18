import type { ElectronAPI } from '@electron-toolkit/preload'

export type UnsubscribeFn = () => void
export type TranslationProvider = 'openai' | 'deepl' | 'google' | 'manual'

export interface TranslationStartPayload {
  provider: TranslationProvider
  filePath: string
  modName: string
  sourceLang: string
  targetLang: string
  apiKey?: string
  author?: string
  model?: string
}

export interface TranslationProgressEvent {
  jobId: string
  current: number
  total: number
  source: string
  target: string
}

export interface TranslationDoneEvent {
  jobId: string
  outputPath: string
}

export interface TranslationErrorEvent {
  jobId: string
  message: string
}

export interface TranslationBatchProgressEvent {
  jobId: string
  uid: string
  completed: number
  total: number
  target: string | null
  error?: string
}

export interface TranslationBatchDoneEvent {
  jobId: string
  total: number
  translated: number
  failed: number
  cancelled: boolean
}

export interface TranslationBatchErrorEvent {
  jobId: string
  message: string
}

export interface LogPayload {
  level?: 'error' | 'warn' | 'info'
  scope: string
  message: string
  stack?: string
  meta?: unknown
}

export interface DictionaryEntry {
  id: number
  language1: string
  language2: string
  textLanguage1: string
  textLanguage2: string
  modName: string | null
  uid: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface UpsertDictionaryPayload {
  language1: string
  language2: string
  textLanguage1: string
  textLanguage2: string
  modName?: string | null
  uid?: string | null
}

export interface SimilarEntry {
  original: string
  translated: string
  score: number
}

export interface Language {
  id: number
  code: string
  name: string
  createdAt: string | null
  updatedAt: string | null
}

export interface ModInfo {
  name: string
  totalStrings: number
  translatedStrings: number
  lastFilePath: string | null
  updatedAt: string | null
}

export interface ModWithPriority extends ModInfo {
  priority: number | null
}

export interface DeleteModResult {
  modName: string
  dictionaryRows: number
  hadMeta: boolean
  folderRemoved: boolean
  folderPath: string
}

export interface DeleteModPreview {
  dictionaryRows: number
  folderPath: string
  folderExists: boolean
}

export interface ModMeta {
  metaFilePath: string
  name: string
  folder: string
  author: string
  description: string
  uuid: string
  versionMajor: number
  versionMinor: number
  versionRevision: number
  versionBuild: number
  version64: string
}

export interface TranslationXmlCandidate {
  id: string
  absolutePath: string
  relativePath: string
  stringCount: number
  sizeKb: number
  valid: boolean
  status: 'valid' | 'invalid'
}

export interface PreparedTranslationInput {
  importId: string
  requiresSelection: boolean
  candidates: TranslationXmlCandidate[]
}

export interface CompleteTranslationImportResult {
  xmlPath: string
  meta: ModMeta
}

export type ConfigKey =
  | 'openai_key'
  | 'deepl_key'
  | 'google_key'
  | 'last_source_lang'
  | 'last_target_lang'
  | 'app_language'
  | 'author'
  | 'dictionary_page_size'
  | 'divine_path'

export type UserErrorCode =
  | 'common.unknown'
  | 'common.unsupportedFileType'
  | 'common.noPakInArchive'
  | 'common.noXmlForLanguage'
  | 'translation.apiKeyMissing'
  | 'translation.apiKeyRequired'
  | 'translation.invalidProvider'
  | 'translation.noValidXml'
  | 'translation.invalidFormat'
  | 'translation.fileLoadFailed'
  | 'translation.saveFailed'
  | 'merge.sessionExpired'
  | 'merge.invalidXml'
  | 'merge.modNameRequired'
  | 'merge.languagesMustDiffer'
  | 'dictionary.xlsxNotSupported'
  | 'package.versionFormatInvalid'
  | 'package.languageFolderInvalid'
  | 'package.folderInvalid'

export type XmlMatchType = 'none' | 'mod-text' | 'text' | 'manual'

export interface DictionaryFilters {
  text?: string
  modName?: string
  sourceLang?: string
  targetLang?: string
}

export interface DictionaryListParams {
  filters: DictionaryFilters
  page: number
  pageSize: number
}

export interface DictionaryListResult {
  items: DictionaryEntry[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface DictionaryImportPreviewRow {
  sourceLang: string
  targetLang: string
  sourceText: string
  targetText: string
  modName: string | null
  uid: string | null
}

export interface DictionaryImportPreview {
  headers: string[]
  totalRows: number
  rows: DictionaryImportPreviewRow[]
}

export interface XmlEntry {
  uid: string
  version: string
  source: string
  target: string
  matchType: XmlMatchType
}

export interface TranslationApi {
  start(payload: TranslationStartPayload): Promise<{ jobId: string }>
  cancel(jobId: string): Promise<void>
  onProgress(cb: (data: TranslationProgressEvent) => void): UnsubscribeFn
  onDone(cb: (data: TranslationDoneEvent) => void): UnsubscribeFn
  onError(cb: (data: TranslationErrorEvent) => void): UnsubscribeFn
  single(payload: {
    provider: 'openai' | 'deepl' | 'google'
    text: string
    sourceLang: string
    targetLang: string
  }): Promise<string>
  batch(payload: {
    entries: { uid: string; source: string }[]
    provider: 'openai' | 'deepl' | 'google'
    sourceLang: string
    targetLang: string
  }): Promise<{ jobId: string }>
  onBatchProgress(cb: (data: TranslationBatchProgressEvent) => void): UnsubscribeFn
  onBatchDone(cb: (data: TranslationBatchDoneEvent) => void): UnsubscribeFn
  onBatchError(cb: (data: TranslationBatchErrorEvent) => void): UnsubscribeFn
}

export type DictionaryImportProgressUpdate =
  | { phase: 'reading' }
  | { phase: 'parsing' }
  | { phase: 'writing'; processed: number; total: number }

export interface DictionaryApi {
  list(params: DictionaryListParams): Promise<DictionaryListResult>
  getAll(params: { lang1: string; lang2: string }): Promise<DictionaryEntry[]>
  search(params: { text: string; lang1: string; lang2: string }): Promise<DictionaryEntry[]>
  create(entry: UpsertDictionaryPayload): Promise<{ success: boolean }>
  update(params: { id: number; entry: UpsertDictionaryPayload }): Promise<{ success: boolean }>
  upsert(entry: UpsertDictionaryPayload): Promise<{ success: boolean }>
  bulkUpsert(entries: UpsertDictionaryPayload[]): Promise<{ count: number }>
  delete(params: { id: number }): Promise<{ success: boolean }>
  previewImport(params: {
    filePath: string
    format: 'csv' | 'xlsx'
  }): Promise<DictionaryImportPreview>
  import(params: { filePath: string; format: 'csv' | 'xlsx' }): Promise<{ count: number }>
  onImportProgress(cb: (data: DictionaryImportProgressUpdate) => void): () => void
  export(params: {
    filters: DictionaryFilters
    format: 'csv' | 'xlsx'
    outputPath: string
  }): Promise<{ success: boolean }>
  similar(params: {
    text: string
    lang1: string
    lang2: string
    limit?: number
  }): Promise<SimilarEntry[]>
  deleteByFilter(filters: DictionaryFilters): Promise<{ deleted: number }>
  replaceByFilter(
    filters: DictionaryFilters,
    patch: { findText: string; replaceText: string; column: 'language1' | 'language2' }
  ): Promise<{ updated: number }>
}

export interface LanguageApi {
  getAll(): Promise<Language[]>
}

export interface ModApi {
  extract(params: {
    inputPath: string
    outputPath: string
    sourceLang?: string
  }): Promise<{ success: boolean; xmlFiles: string[] }>
  pack(params: {
    inputFolder: string
    outputPath: string
  }): Promise<{ success: boolean; pakPath: string }>
  getAll(params?: { lang1?: string; lang2?: string }): Promise<ModInfo[]>
  upsert(params: {
    name: string
    totalStrings?: number
    lastFilePath?: string
  }): Promise<{ success: boolean }>
  storeFile(params: { modName: string; filePath: string }): Promise<{ storedPath: string }>
  prepareTranslationInput(params: { inputPath: string }): Promise<PreparedTranslationInput>
  discardTranslationInput(params: { importId: string }): Promise<{ success: boolean }>
  completeTranslationImport(params: {
    importId: string
    candidateIds: string[]
    modName: string
    targetLang: string
  }): Promise<CompleteTranslationImportResult>
  getMeta(params: { modName: string; targetLang: string }): Promise<ModMeta>
  upsertMeta(params: { modName: string; meta: ModMeta }): Promise<ModMeta>
  exportTranslatedPackage(params: {
    outputPath: string
    format: 'pak' | 'zip'
    modName: string
    entries: XmlEntry[]
    meta: ModMeta
    bg3LanguageFolder: string
  }): Promise<{ outputPath: string }>
  delete(params: { modName: string }): Promise<DeleteModResult>
  previewDelete(params: { modName: string }): Promise<DeleteModPreview>
  setPriority(params: { modName: string; priority: number | null }): Promise<{ success: boolean }>
  reorderPriority(params: { orderedNames: string[] }): Promise<{ success: boolean }>
  listWithPriority(params?: { lang1?: string; lang2?: string }): Promise<ModWithPriority[]>
}

export interface MergeResult {
  matched: number
  sourceOnly: number
  targetOnly: number
}

export type MergeProgress =
  | { phase: 'parsing' }
  | { phase: 'loading-map' }
  | { phase: 'classifying' }
  | { phase: 'writing'; processed: number; total: number }
  | { phase: 'done'; result: MergeResult }
  | { phase: 'error'; message: string }

export interface MergeApi {
  prepareInput(params: { inputPath: string }): Promise<PreparedTranslationInput>
  discardInput(params: { importId: string }): Promise<{ success: boolean }>
  run(params: {
    sourceImportId: string
    sourceCandidateId: string
    sourceLang: string
    targetImportId: string
    targetCandidateId: string
    targetLang: string
    modName: string
  }): Promise<MergeResult>
  onProgress(cb: (data: MergeProgress) => void): UnsubscribeFn
}

export type XmlLoadProgress =
  | { phase: 'unpacking' }
  | { phase: 'parsing' }
  | { phase: 'loading-cache' }
  | { phase: 'matching'; processed: number; total: number }

export interface XmlApi {
  load(params: {
    inputPath: string
    sourceLang: string
    targetLang: string
    modName?: string
  }): Promise<XmlEntry[]>
  export(params: { outputPath: string; entries: XmlEntry[] }): Promise<void>
  onLoadProgress(cb: (data: XmlLoadProgress) => void): UnsubscribeFn
}

export interface ConfigApi {
  get(params: { key: string }): Promise<{ value: string | null }>
  set(params: { key: string; value: string }): Promise<{ success: boolean }>
  getAll(): Promise<Record<string, string>>
}

export interface WindowApi {
  minimize(): Promise<void>
  maximize(): Promise<void>
  close(): Promise<void>
  isMaximized(): Promise<boolean>
  onMaximizeChange(cb: (isMaximized: boolean) => void): UnsubscribeFn
}

export interface FsApi {
  openDialog(params?: { filters?: Electron.FileFilter[]; multiple?: boolean }): Promise<string[]>
  saveDialog(params?: {
    defaultName?: string
    filters?: Electron.FileFilter[]
  }): Promise<string | null>
  openFolder(): Promise<string | null>
  getPathForFile(file: File): string
}

export interface LogApi {
  getPath(): Promise<string>
  open(): Promise<{ success: boolean }>
  clear(): Promise<{ success: boolean }>
  write(payload: LogPayload): Promise<{ success: boolean }>
}

export type MetricsService = 'deepl' | 'google'
export type MetricsRunService = 'deepl' | 'google' | 'openai' | 'manual'

export interface MetricsUsage {
  service: MetricsService
  consumedChars: number
  charLimit: number
  renewalAt: string
  createdAt: string | null
  updatedAt: string | null
}

export interface MetricsRun {
  id: number
  jobId: string | null
  service: MetricsRunService
  modName: string | null
  sourceLang: string
  targetLang: string
  entriesTotal: number
  entriesTranslated: number
  charsConsumed: number
  startedAt: string
  finishedAt: string
}

export interface MetricsDailyBucket {
  date: string
  entries: number
  chars: number
  runs: number
}

export interface MetricsModBucket {
  modName: string | null
  entries: number
  runs: number
}

export interface MetricsApi {
  getUsage(payload: { service: MetricsService }): Promise<MetricsUsage>
  getAllUsage(): Promise<MetricsUsage[]>
  setLimit(payload: { service: MetricsService; charLimit: number }): Promise<MetricsUsage>
  setRenewalAt(payload: { service: MetricsService; renewalAt: string }): Promise<MetricsUsage>
  setConsumed(payload: { service: MetricsService; consumedChars: number }): Promise<MetricsUsage>
  listRuns(payload?: {
    limit?: number
    service?: MetricsRunService
    from?: string
    to?: string
  }): Promise<MetricsRun[]>
  aggregateByDay(payload: {
    from: string
    to: string
    service?: MetricsRunService
  }): Promise<MetricsDailyBucket[]>
  aggregateByMod(payload: {
    from: string
    to: string
    service?: MetricsRunService
  }): Promise<MetricsModBucket[]>
}

export interface AppApi {
  translation: TranslationApi
  dictionary: DictionaryApi
  language: LanguageApi
  mod: ModApi
  config: ConfigApi
  fs: FsApi
  log: LogApi
  xml: XmlApi
  merge: MergeApi
  window: WindowApi
  metrics: MetricsApi
}

export interface AppWindow {
  electron: ElectronAPI
  api: AppApi
}
