import { electronAPI } from '@electron-toolkit/preload'
import type { IpcRendererEvent } from 'electron'
import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  AppApi,
  TranslationBatchDoneEvent,
  TranslationBatchErrorEvent,
  TranslationBatchProgressEvent,
  UnsubscribeFn
} from './api-types'

function on<T>(channel: string, cb: (data: T) => void): UnsubscribeFn {
  const handler = (_: IpcRendererEvent, data: T): void => cb(data)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: AppApi = {
  translation: {
    start: (payload: {
      provider: 'openai' | 'deepl' | 'manual'
      filePath: string
      modName: string
      sourceLang: string
      targetLang: string
      apiKey?: string
      author?: string
    }): Promise<{ jobId: string }> => ipcRenderer.invoke('translation:start', payload),

    cancel: (jobId: string): Promise<void> => ipcRenderer.invoke('translation:cancel', { jobId }),

    onProgress: (
      cb: (data: {
        jobId: string
        current: number
        total: number
        source: string
        target: string
      }) => void
    ): UnsubscribeFn => on('translation:progress', cb),

    onDone: (cb: (data: { jobId: string; outputPath: string }) => void): UnsubscribeFn =>
      on('translation:done', cb),

    onError: (cb: (data: { jobId: string; message: string }) => void): UnsubscribeFn =>
      on('translation:error', cb),

    single: (payload: {
      provider: 'openai' | 'deepl'
      text: string
      sourceLang: string
      targetLang: string
    }): Promise<string> => ipcRenderer.invoke('translation:single', payload),

    batch: (payload: {
      entries: { uid: string; source: string }[]
      provider: 'openai' | 'deepl'
      sourceLang: string
      targetLang: string
    }): Promise<{ jobId: string }> =>
      ipcRenderer.invoke('translation:batch', payload),

    onBatchProgress: (
      cb: (data: TranslationBatchProgressEvent) => void
    ): UnsubscribeFn => on('translation:batchProgress', cb),

    onBatchDone: (cb: (data: TranslationBatchDoneEvent) => void): UnsubscribeFn =>
      on('translation:batchDone', cb),

    onBatchError: (cb: (data: TranslationBatchErrorEvent) => void): UnsubscribeFn =>
      on('translation:batchError', cb)
  },

  dictionary: {
    list: (filters: {
      text?: string
      modName?: string
      sourceLang?: string
      targetLang?: string
    }) => ipcRenderer.invoke('dictionary:list', filters),

    getAll: (params: { lang1: string; lang2: string }) =>
      ipcRenderer.invoke('dictionary:getAll', params),

    search: (params: { text: string; lang1: string; lang2: string }) =>
      ipcRenderer.invoke('dictionary:search', params),

    create: (entry: {
      language1: string
      language2: string
      textLanguage1: string
      textLanguage2: string
      modName?: string | null
      uid?: string | null
    }): Promise<{ success: boolean }> => ipcRenderer.invoke('dictionary:create', entry),

    update: (params: {
      id: number
      entry: {
        language1: string
        language2: string
        textLanguage1: string
        textLanguage2: string
        modName?: string | null
        uid?: string | null
      }
    }): Promise<{ success: boolean }> => ipcRenderer.invoke('dictionary:update', params),

    upsert: (entry: {
      language1: string
      language2: string
      textLanguage1: string
      textLanguage2: string
      modName?: string | null
      uid?: string | null
    }): Promise<{ success: boolean }> => ipcRenderer.invoke('dictionary:upsert', entry),

    delete: (params: { id: number }): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('dictionary:delete', params),

    previewImport: (params: {
      filePath: string
      format: 'csv' | 'xlsx'
    }) => ipcRenderer.invoke('dictionary:previewImport', params),

    import: (params: { filePath: string; format: 'csv' | 'xlsx' }): Promise<{ count: number }> =>
      ipcRenderer.invoke('dictionary:import', params),

    export: (params: {
      filters: {
        text?: string
        modName?: string
        sourceLang?: string
        targetLang?: string
      }
      format: 'csv' | 'xlsx'
      outputPath: string
    }): Promise<{ success: boolean }> => ipcRenderer.invoke('dictionary:export', params),

    similar: (params: { text: string; lang1: string; lang2: string; limit?: number }) =>
      ipcRenderer.invoke('dictionary:similar', params)
  },

  language: {
    getAll: () => ipcRenderer.invoke('language:getAll')
  },

  mod: {
    extract: (params: {
      inputPath: string
      outputPath: string
      sourceLang?: string
    }): Promise<{ success: boolean; xmlFiles: string[] }> =>
      ipcRenderer.invoke('mod:extract', params),

    pack: (params: {
      inputFolder: string
      outputPath: string
    }): Promise<{ success: boolean; pakPath: string }> => ipcRenderer.invoke('mod:pack', params),

    getAll: (params?: {
      lang1?: string
      lang2?: string
    }): Promise<
      {
        name: string
        totalStrings: number
        translatedStrings: number
        lastFilePath: string | null
        updatedAt: string | null
      }[]
    > => ipcRenderer.invoke('mod:getAll', params),

    upsert: (params: {
      name: string
      totalStrings?: number
      lastFilePath?: string
    }): Promise<{ success: boolean }> => ipcRenderer.invoke('mod:upsert', params),

    storeFile: (params: { modName: string; filePath: string }): Promise<{ storedPath: string }> =>
      ipcRenderer.invoke('mod:storeFile', params),

    prepareTranslationInput: (params: { inputPath: string }) =>
      ipcRenderer.invoke('mod:prepareTranslationInput', params),

    discardTranslationInput: (params: { importId: string }): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('mod:discardTranslationInput', params),

    completeTranslationImport: (params: {
      importId: string
      candidateId: string
      modName: string
      targetLang: string
    }) => ipcRenderer.invoke('mod:completeTranslationImport', params),

    getMeta: (params: { modName: string; targetLang: string }) =>
      ipcRenderer.invoke('mod:getMeta', params),

    upsertMeta: (params: {
      modName: string
      meta: {
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
    }) => ipcRenderer.invoke('mod:upsertMeta', params),

    exportTranslatedPackage: (params: {
      outputPath: string
      format: 'pak' | 'zip'
      modName: string
      entries: { uid: string; version: string; source: string; target: string; matchType: string }[]
      meta: {
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
      bg3LanguageFolder: string
    }): Promise<{ outputPath: string }> => ipcRenderer.invoke('mod:exportTranslatedPackage', params)
  },

  xml: {
    load: (params: {
      inputPath: string
      sourceLang: string
      targetLang: string
      modName?: string
    }): Promise<
      {
        uid: string
        version: string
        source: string
        target: string
        matchType: 'none' | 'mod-text' | 'text' | 'manual'
      }[]
    > => ipcRenderer.invoke('xml:load', params),

    export: (params: {
      outputPath: string
      entries: { uid: string; version: string; source: string; target: string; matchType: string }[]
    }): Promise<void> => ipcRenderer.invoke('xml:export', params)
  },

  config: {
    get: (params: { key: string }): Promise<{ value: string | null }> =>
      ipcRenderer.invoke('config:get', params),

    set: (params: { key: string; value: string }): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('config:set', params),

    getAll: (): Promise<Record<string, string>> => ipcRenderer.invoke('config:getAll')
  },

  window: {
    minimize: (): Promise<void> => ipcRenderer.invoke('window:minimize'),
    maximize: (): Promise<void> => ipcRenderer.invoke('window:maximize'),
    close: (): Promise<void> => ipcRenderer.invoke('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:isMaximized'),
    onMaximizeChange: (cb: (isMaximized: boolean) => void): UnsubscribeFn =>
      on('window:maximizeChange', cb)
  },

  fs: {
    openDialog: (params?: {
      filters?: Electron.FileFilter[]
      multiple?: boolean
    }): Promise<string[]> => ipcRenderer.invoke('fs:openDialog', params),

    saveDialog: (params?: {
      defaultName?: string
      filters?: Electron.FileFilter[]
    }): Promise<string | null> => ipcRenderer.invoke('fs:saveDialog', params),

    openFolder: (): Promise<string | null> => ipcRenderer.invoke('fs:openFolder'),

    // Replaces the deprecated file.path property (removed in Electron 32+)
    getPathForFile: (file: File): string => webUtils.getPathForFile(file)
  },

  log: {
    getPath: (): Promise<string> => ipcRenderer.invoke('log:getPath'),
    open: (): Promise<{ success: boolean }> => ipcRenderer.invoke('log:open'),
    clear: (): Promise<{ success: boolean }> => ipcRenderer.invoke('log:clear'),
    write: (payload: {
      level?: 'error' | 'warn' | 'info'
      scope: string
      message: string
      stack?: string
      meta?: unknown
    }): Promise<{ success: boolean }> => ipcRenderer.invoke('log:write', payload)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error (define in dts)
  window.electron = electronAPI
  // @ts-expect-error (define in dts)
  window.api = api
}
