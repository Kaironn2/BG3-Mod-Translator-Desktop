import { ElectronAPI } from '@electron-toolkit/preload'
import type {
  DictionaryEntry,
  Language,
  SimilarEntry,
  TranslationStartPayload,
  TranslationProgressEvent,
  TranslationDoneEvent,
  TranslationErrorEvent
} from '../renderer/src/types'

type UnsubscribeFn = () => void

interface TranslationApi {
  start(payload: TranslationStartPayload): Promise<{ jobId: string }>
  cancel(jobId: string): Promise<void>
  onProgress(cb: (data: TranslationProgressEvent) => void): UnsubscribeFn
  onDone(cb: (data: TranslationDoneEvent) => void): UnsubscribeFn
  onError(cb: (data: TranslationErrorEvent) => void): UnsubscribeFn
}

interface DictionaryApi {
  getAll(params: { lang1: string; lang2: string }): Promise<DictionaryEntry[]>
  search(params: { text: string; lang1: string; lang2: string }): Promise<DictionaryEntry[]>
  upsert(entry: {
    language1: string
    language2: string
    textLanguage1: string
    textLanguage2: string
    modName?: string | null
    uid?: string | null
  }): Promise<{ success: boolean }>
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

interface LanguageApi {
  getAll(): Promise<Language[]>
}

interface ModApi {
  extract(params: {
    inputPath: string
    outputPath: string
    sourceLang?: string
  }): Promise<{ success: boolean; xmlFiles: string[] }>
  pack(params: {
    inputFolder: string
    outputPath: string
  }): Promise<{ success: boolean; pakPath: string }>
}

interface ConfigApi {
  get(params: { key: string }): Promise<{ value: string | null }>
  set(params: { key: string; value: string }): Promise<{ success: boolean }>
  getAll(): Promise<Record<string, string>>
}

interface FsApi {
  openDialog(params?: { filters?: Electron.FileFilter[]; multiple?: boolean }): Promise<string[]>
  saveDialog(params?: {
    defaultName?: string
    filters?: Electron.FileFilter[]
  }): Promise<string | null>
  openFolder(): Promise<string | null>
  getPathForFile(file: File): string
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      translation: TranslationApi
      dictionary: DictionaryApi
      language: LanguageApi
      mod: ModApi
      config: ConfigApi
      fs: FsApi
    }
  }
}
