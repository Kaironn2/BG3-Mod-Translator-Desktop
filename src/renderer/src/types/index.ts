// Shared types between main process and renderer.
// Intentionally self-contained — renderer cannot import from main.

export type TranslationProvider = 'openai' | 'deepl' | 'manual'

export interface TranslationStartPayload {
  provider: TranslationProvider
  filePath: string
  modName: string
  sourceLang: string
  targetLang: string
  apiKey?: string
  author?: string
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

export interface FileFilter {
  name: string
  extensions: string[]
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
