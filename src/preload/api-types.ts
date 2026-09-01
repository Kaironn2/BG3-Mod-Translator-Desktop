import type { ElectronAPI } from '@electron-toolkit/preload'

export type UnsubscribeFn = () => void
export type AiProviderId = 'openai' | 'anthropic' | 'gemini' | 'grok' | 'zai' | 'deepseek'
export type TranslationProvider = AiProviderId | 'deepl' | 'google' | 'manual'

// Paid-tier defaults for batch pacing. Gemini stays on the free-tier floor.
export const AI_TUNING_RANGE = {
  concurrency: { min: 1, max: 20 },
  batchLines: { min: 1, max: 100 }
} as const

export const DEFAULT_AI_TUNING: Record<AiProviderId, { concurrency: number; batchLines: number }> =
  {
    openai: { concurrency: 3, batchLines: 20 },
    anthropic: { concurrency: 3, batchLines: 20 },
    grok: { concurrency: 3, batchLines: 20 },
    zai: { concurrency: 2, batchLines: 20 },
    deepseek: { concurrency: 3, batchLines: 20 },
    gemini: { concurrency: 1, batchLines: 8 }
  }

// The four variables every translation prompt must contain. Highlighted in the editor and
// validated before a prompt slot can be saved (shared by main + renderer).
export const REQUIRED_PROMPT_VARS = [
  'SOURCE_TEXT',
  'SOURCE_LANGUAGE',
  'TARGET_TEXT',
  'TARGET_LANGUAGE'
] as const

export function missingPromptVars(template: string): string[] {
  return REQUIRED_PROMPT_VARS.filter((v) => !template.includes(`{${v}}`))
}

// {ALL_CAPS} tokens that are not one of the required variables - almost always a typo
// (e.g. {SOURCE_LAGUAGE}). They would reach the AI as literal text, so they block saving.
// Lowercase/numeric braces ({0}, {1}) are game placeholders and stay untouched.
export function unknownPromptVars(template: string): string[] {
  const required = new Set<string>(REQUIRED_PROMPT_VARS)
  const unknown = new Set<string>()
  for (const match of template.matchAll(/\{([A-Z_]+)\}/g)) {
    if (!required.has(match[1])) unknown.add(match[1])
  }
  return [...unknown]
}

// Sections the system appends to every rendered prompt (reference examples; the mandatory
// response-format block that keeps grouped batch replies parseable). A template containing
// them would duplicate/conflict with the appended blocks, so saving is blocked.
export const RESERVED_PROMPT_HEADINGS = ['## Response format', '## Reference examples'] as const

export function reservedPromptHeadings(template: string): string[] {
  return RESERVED_PROMPT_HEADINGS.filter((heading) => template.includes(heading))
}

export interface AiSimilarityExample {
  src: string
  tgt: string
}

export interface PromptSlot {
  id: number
  name: string
  prompt: string
  isDefault: boolean
  createdAt: string | null
  updatedAt: string | null
}

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

export type TranslationBatchWaitingReason = 'pace' | 'retry' | 'cooldown'

export interface TranslationBatchWaitingEvent {
  jobId: string
  providerId: string
  delayMs: number
  attempt: number
  maxAttempts: number
  reason: TranslationBatchWaitingReason
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

// Larian Localization folder names. Display names stay on Language.name (UI + AI prompts);
// extract/export must use these folders or official language packs are missed.
export const BG3_OFFICIAL_LANGUAGE_FOLDERS = {
  de: 'German',
  en: 'English',
  es: 'Spanish',
  'es-419': 'LatinSpanish',
  fr: 'French',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  pl: 'Polish',
  'pt-BR': 'BrazilianPortuguese',
  ru: 'Russian',
  tr: 'Turkish',
  uk: 'Ukrainian',
  'zh-CN': 'Chinese',
  'zh-TW': 'ChineseTraditional'
} as const

export type Bg3OfficialLanguageCode = keyof typeof BG3_OFFICIAL_LANGUAGE_FOLDERS

export function isOfficialBg3Language(code: string): code is Bg3OfficialLanguageCode {
  return Object.hasOwn(BG3_OFFICIAL_LANGUAGE_FOLDERS, code)
}

export function toBg3LanguageFolder(code: string, name?: string | null): string {
  if (isOfficialBg3Language(code)) return BG3_OFFICIAL_LANGUAGE_FOLDERS[code]
  return (name ?? code).replace(/[^a-zA-Z0-9]/g, '')
}

export const DEFAULT_SOURCE_LANG = 'en'
export const DEFAULT_TARGET_LANG = 'pt-BR'

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

export interface DeleteModPreviewItem extends DeleteModPreview {
  modName: string
}

export interface DeleteModsPreview {
  mods: DeleteModPreviewItem[]
  totalMods: number
  totalRows: number
  foldersToRemove: number
}

export interface DeleteModsResult {
  dictionaryRows: number
  mods: DeleteModResult[]
}

export type ModDeleteProgressUpdate =
  | { phase: 'counting'; total?: number }
  | { phase: 'deleting'; processed?: number; total?: number }
  | { phase: 'folders' }

export type DictionaryDeleteProgressUpdate =
  | { phase: 'counting'; total: number }
  | { phase: 'deleting'; processed: number; total: number }

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
  fileType: 'xml' | 'loca'
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
  | 'anthropic_key'
  | 'gemini_key'
  | 'grok_key'
  | 'zai_key'
  | 'deepseek_key'
  | 'openai_model'
  | 'anthropic_model'
  | 'gemini_model'
  | 'grok_model'
  | 'zai_model'
  | 'deepseek_model'
  | 'openai_concurrency'
  | 'anthropic_concurrency'
  | 'gemini_concurrency'
  | 'grok_concurrency'
  | 'zai_concurrency'
  | 'deepseek_concurrency'
  | 'openai_batch_lines'
  | 'anthropic_batch_lines'
  | 'gemini_batch_lines'
  | 'grok_batch_lines'
  | 'zai_batch_lines'
  | 'deepseek_batch_lines'
  | 'ai_provider'
  | 'ai_active_prompt_slot'
  | 'ai_similarity_enabled'
  | 'ai_similarity_count'
  | 'ai_similarity_min_score'
  | 'last_source_lang'
  | 'last_target_lang'
  | 'app_language'
  | 'author'
  | 'dictionary_page_size'
  | 'default_export_language'
  | 'default_extract_path'
  | 'default_pack_path'
  | 'last_extract_path'
  | 'last_pack_path'

export type UserErrorCode =
  | 'common.unknown'
  | 'common.unsupportedFileType'
  | 'common.noPakInArchive'
  | 'common.noXmlForLanguage'
  | 'translation.apiKeyMissing'
  | 'translation.apiKeyRequired'
  | 'translation.aiRateLimited'
  | 'translation.aiQuotaExhausted'
  | 'translation.invalidProvider'
  | 'translation.noValidXml'
  | 'translation.mixedFormats'
  | 'translation.invalidFormat'
  | 'translation.fileLoadFailed'
  | 'translation.saveFailed'
  | 'merge.sessionExpired'
  | 'merge.invalidXml'
  | 'merge.modNameRequired'
  | 'merge.languagesMustDiffer'
  | 'dictionary.xlsxNotSupported'
  | 'dictionary.deleteInProgress'
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
  // Original localization file (basename) this entry came from; null for legacy data.
  sourceFile?: string | null
  sourceFileType?: 'xml' | 'loca' | null
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
  onBatchWaiting(cb: (data: TranslationBatchWaitingEvent) => void): UnsubscribeFn
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
  deleteMany(params: { ids: number[] }): Promise<{ deleted: number }>
  previewImport(params: {
    filePath: string
    format: 'csv' | 'xlsx'
  }): Promise<DictionaryImportPreview>
  import(params: { filePath: string; format: 'csv' | 'xlsx' }): Promise<{ count: number }>
  onImportProgress(cb: (data: DictionaryImportProgressUpdate) => void): () => void
  onDeleteProgress(cb: (data: DictionaryDeleteProgressUpdate) => void): () => void
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
    exportFileType?: 'xml' | 'loca'
    preserveSourceFiles?: boolean
  }): Promise<{ outputPath: string }>
  delete(params: { modName: string }): Promise<DeleteModResult>
  deleteMany(params: { modNames: string[] }): Promise<DeleteModsResult>
  previewDelete(params: { modName: string }): Promise<DeleteModPreview>
  previewDeleteMany(params: { modNames: string[] }): Promise<DeleteModsPreview>
  onDeleteProgress(cb: (data: ModDeleteProgressUpdate) => void): UnsubscribeFn
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

export type MergePrepareProgress = {
  requestId: string
} & (
  | { phase: 'extracting'; processed?: number; total?: number }
  | { phase: 'unpacking'; processed?: number; total?: number }
  | { phase: 'scanning'; processed?: number; total?: number }
)

export interface MergeApi {
  prepareInput(params: { inputPath: string; requestId: string }): Promise<PreparedTranslationInput>
  cancelPrepare(params: { requestId: string }): Promise<{ success: boolean }>
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
  onPrepareProgress(cb: (data: MergePrepareProgress) => void): UnsubscribeFn
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
  export(params: {
    outputPath: string
    entries: XmlEntry[]
    fileType?: 'xml' | 'loca'
  }): Promise<void>
  exportPerSourceFile(params: {
    outputDir: string
    entries: XmlEntry[]
    fallbackFileName: string
    fileType?: 'xml' | 'loca'
  }): Promise<string[]>
  onLoadProgress(cb: (data: XmlLoadProgress) => void): UnsubscribeFn
}

export interface ConfigApi {
  get(params: { key: string }): Promise<{ value: string | null }>
  set(params: { key: string; value: string }): Promise<{ success: boolean }>
  getAll(): Promise<Record<string, string>>
}

export interface AiTranslatePayload {
  // Omitted ⇒ the active provider stored in config is used.
  provider?: AiProviderId
  model?: string
  text: string
  sourceLang: string
  targetLang: string
  // The per-line template (may have been edited in the popup); rendered server-side.
  prompt: string
  examples: AiSimilarityExample[]
}

export interface AiBatchPayload {
  provider?: AiProviderId
  entries: { uid: string; source: string }[]
  sourceLang: string
  targetLang: string
}

// Batch progress/done/error reuse the existing translation:batch* events.
export interface AiApi {
  translate(payload: AiTranslatePayload): Promise<string>
  translateBatch(payload: AiBatchPayload): Promise<{ jobId: string }>
}

export interface PromptSlotApi {
  list(): Promise<PromptSlot[]>
  create(params: { name: string; prompt: string }): Promise<PromptSlot>
  update(params: { id: number; name?: string; prompt?: string }): Promise<PromptSlot>
  delete(params: { id: number }): Promise<{ success: boolean }>
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

export type UpdaterChannel = 'installed' | 'portable' | 'dev' | 'unsupported'

export type UpdaterStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'backing-up'
  | 'downloading'
  | 'ready'
  | 'installing'
  | 'error'

export interface UpdaterChangelog {
  fromVersion: string
  toVersion: string
  url: string
}

export interface UpdaterState {
  currentVersion: string
  channel: UpdaterChannel
  status: UpdaterStatus
  latestVersion: string | null
  releaseUrl: string | null
  lastCheckedAt: string | null
  downloadPercent: number
  downloadedBytes: number
  totalBytes: number
  backupPercent: number
  errorCode: string | null
  changelog: UpdaterChangelog | null
}

export interface UpdaterApi {
  getState(): Promise<UpdaterState>
  check(): Promise<UpdaterState>
  install(): Promise<void>
  ackChangelog(): Promise<UpdaterState>
  onState(cb: (state: UpdaterState) => void): UnsubscribeFn
}

export interface AppApi {
  translation: TranslationApi
  dictionary: DictionaryApi
  language: LanguageApi
  mod: ModApi
  config: ConfigApi
  ai: AiApi
  promptSlot: PromptSlotApi
  fs: FsApi
  log: LogApi
  xml: XmlApi
  merge: MergeApi
  window: WindowApi
  metrics: MetricsApi
  updater: UpdaterApi
}

export interface AppWindow {
  electron: ElectronAPI
  api: AppApi
}
