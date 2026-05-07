import type { ElectronAPI } from '@electron-toolkit/preload'

export type UnsubscribeFn = () => void
export type TranslationProvider = 'openai' | 'deepl' | 'manual'

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
  uid: string
  target: string | null
  error?: string
}

export interface TranslationBatchSummary {
  total: number
  translated: number
  failed: number
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
  | 'last_source_lang'
  | 'last_target_lang'
  | 'author'
  | 'divine_path'

export type XmlMatchType = 'none' | 'uid' | 'text' | 'manual'

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
    provider: 'openai' | 'deepl'
    text: string
    sourceLang: string
    targetLang: string
  }): Promise<string>
  batch(payload: {
    entries: { uid: string; source: string }[]
    provider: 'openai' | 'deepl'
    sourceLang: string
    targetLang: string
  }): Promise<TranslationBatchSummary>
  onBatchProgress(cb: (data: TranslationBatchProgressEvent) => void): UnsubscribeFn
}

export interface DictionaryApi {
  getAll(params: { lang1: string; lang2: string }): Promise<DictionaryEntry[]>
  search(params: { text: string; lang1: string; lang2: string }): Promise<DictionaryEntry[]>
  upsert(entry: UpsertDictionaryPayload): Promise<{ success: boolean }>
  delete(params: { id: number }): Promise<{ success: boolean }>
  import(params: { filePath: string; format: 'csv' | 'xlsx' }): Promise<{ count: number }>
  export(params: {
    lang1: string
    lang2: string
    format: 'csv' | 'xlsx'
    outputPath: string
  }): Promise<{ success: boolean }>
  similar(params: {
    text: string
    lang1: string
    lang2: string
    limit?: number
  }): Promise<SimilarEntry[]>
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
    candidateId: string
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
}

export interface XmlApi {
  load(params: { inputPath: string; sourceLang: string; targetLang: string }): Promise<XmlEntry[]>
  export(params: { outputPath: string; entries: XmlEntry[] }): Promise<void>
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

export interface AppApi {
  translation: TranslationApi
  dictionary: DictionaryApi
  language: LanguageApi
  mod: ModApi
  config: ConfigApi
  fs: FsApi
  log: LogApi
  xml: XmlApi
  window: WindowApi
}

export interface AppWindow {
  electron: ElectronAPI
  api: AppApi
}
