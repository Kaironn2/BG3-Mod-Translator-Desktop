import { electronAPI } from '@electron-toolkit/preload'
import type { IpcRendererEvent } from 'electron'
import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type {
  AiBatchPayload,
  AiTranslatePayload,
  AppApi,
  PromptSlot,
  TranslationBatchDoneEvent,
  TranslationBatchErrorEvent,
  TranslationBatchProgressEvent,
  TranslationBatchWaitingEvent,
  TranslationStartPayload,
  UnsubscribeFn
} from './api-types'

function on<T>(channel: string, cb: (data: T) => void): UnsubscribeFn {
  const handler = (_: IpcRendererEvent, data: T): void => cb(data)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api: AppApi = {
  translation: {
    start: (payload: TranslationStartPayload): Promise<{ jobId: string }> =>
      ipcRenderer.invoke('translation:start', payload),

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
      provider: 'openai' | 'deepl' | 'google'
      text: string
      sourceLang: string
      targetLang: string
    }): Promise<string> => ipcRenderer.invoke('translation:single', payload),

    batch: (payload: {
      entries: { uid: string; source: string }[]
      provider: 'openai' | 'deepl' | 'google'
      sourceLang: string
      targetLang: string
    }): Promise<{ jobId: string }> => ipcRenderer.invoke('translation:batch', payload),

    onBatchProgress: (cb: (data: TranslationBatchProgressEvent) => void): UnsubscribeFn =>
      on('translation:batchProgress', cb),

    onBatchDone: (cb: (data: TranslationBatchDoneEvent) => void): UnsubscribeFn =>
      on('translation:batchDone', cb),

    onBatchError: (cb: (data: TranslationBatchErrorEvent) => void): UnsubscribeFn =>
      on('translation:batchError', cb),

    onBatchWaiting: (cb: (data: TranslationBatchWaitingEvent) => void): UnsubscribeFn =>
      on('translation:batchWaiting', cb)
  },

  dictionary: {
    list: (params: {
      filters: {
        text?: string
        modName?: string
        sourceLang?: string
        targetLang?: string
      }
      page: number
      pageSize: number
    }) => ipcRenderer.invoke('dictionary:list', params),

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

    bulkUpsert: (
      entries: {
        language1: string
        language2: string
        textLanguage1: string
        textLanguage2: string
        modName?: string | null
        uid?: string | null
      }[]
    ): Promise<{ count: number }> => ipcRenderer.invoke('dictionary:bulkUpsert', entries),

    delete: (params: { id: number }): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('dictionary:delete', params),

    deleteMany: (params: { ids: number[] }): Promise<{ deleted: number }> =>
      ipcRenderer.invoke('dictionary:deleteMany', params),

    previewImport: (params: { filePath: string; format: 'csv' | 'xlsx' }) =>
      ipcRenderer.invoke('dictionary:previewImport', params),

    import: (params: { filePath: string; format: 'csv' | 'xlsx' }): Promise<{ count: number }> =>
      ipcRenderer.invoke('dictionary:import', params),

    onImportProgress: (
      cb: (data: import('./api-types').DictionaryImportProgressUpdate) => void
    ): UnsubscribeFn => on('dictionary:import:progress', cb),

    onDeleteProgress: (
      cb: (data: import('./api-types').DictionaryDeleteProgressUpdate) => void
    ): UnsubscribeFn => on('dictionary:delete:progress', cb),

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
      ipcRenderer.invoke('dictionary:similar', params),

    deleteByFilter: (filters: {
      text?: string
      modName?: string
      sourceLang?: string
      targetLang?: string
    }): Promise<{ deleted: number }> => ipcRenderer.invoke('dictionary:deleteByFilter', filters),

    replaceByFilter: (
      filters: { text?: string; modName?: string; sourceLang?: string; targetLang?: string },
      patch: { findText: string; replaceText: string; column: 'language1' | 'language2' }
    ): Promise<{ updated: number }> =>
      ipcRenderer.invoke('dictionary:replaceByFilter', { filters, patch })
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
      candidateIds: string[]
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
      entries: {
        uid: string
        version: string
        source: string
        target: string
        matchType: string
        sourceFile?: string | null
        sourceFileType?: 'xml' | 'loca' | null
      }[]
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
      exportFileType?: 'xml' | 'loca'
      preserveSourceFiles?: boolean
    }): Promise<{ outputPath: string }> =>
      ipcRenderer.invoke('mod:exportTranslatedPackage', params),

    delete: (params: { modName: string }) => ipcRenderer.invoke('mod:delete', params),

    deleteMany: (params: { modNames: string[] }) => ipcRenderer.invoke('mod:deleteMany', params),

    previewDelete: (params: { modName: string }) => ipcRenderer.invoke('mod:previewDelete', params),

    previewDeleteMany: (params: { modNames: string[] }) =>
      ipcRenderer.invoke('mod:previewDeleteMany', params),

    onDeleteProgress: (
      cb: (data: import('./api-types').ModDeleteProgressUpdate) => void
    ): UnsubscribeFn => on('mod:delete:progress', cb),

    setPriority: (params: { modName: string; priority: number | null }) =>
      ipcRenderer.invoke('mod:setPriority', params),

    reorderPriority: (params: { orderedNames: string[] }) =>
      ipcRenderer.invoke('mod:reorderPriority', params),

    listWithPriority: (params?: { lang1?: string; lang2?: string }) =>
      ipcRenderer.invoke('mod:listWithPriority', params)
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
        sourceFile: string | null
        sourceFileType: 'xml' | 'loca' | null
      }[]
    > => ipcRenderer.invoke('xml:load', params),

    export: (params: {
      outputPath: string
      entries: { uid: string; version: string; source: string; target: string; matchType: string }[]
      fileType?: 'xml' | 'loca'
    }): Promise<void> => ipcRenderer.invoke('xml:export', params),

    exportPerSourceFile: (params: {
      outputDir: string
      entries: { uid: string; version: string; source: string; target: string; matchType: string }[]
      fallbackFileName: string
      fileType?: 'xml' | 'loca'
    }): Promise<string[]> => ipcRenderer.invoke('xml:exportPerSourceFile', params),

    onLoadProgress: (cb: (data: import('./api-types').XmlLoadProgress) => void): UnsubscribeFn =>
      on('xml:load:progress', cb)
  },

  merge: {
    prepareInput: (params: { inputPath: string; requestId: string }) =>
      ipcRenderer.invoke('merge:prepareInput', params),

    cancelPrepare: (params: { requestId: string }): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('merge:cancelPrepare', params),

    discardInput: (params: { importId: string }): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('merge:discardInput', params),

    run: (params: {
      sourceImportId: string
      sourceCandidateId: string
      sourceLang: string
      targetImportId: string
      targetCandidateId: string
      targetLang: string
      modName: string
    }) => ipcRenderer.invoke('merge:run', params),

    onProgress: (cb: (data: import('./api-types').MergeProgress) => void): UnsubscribeFn =>
      on('merge:progress', cb),

    onPrepareProgress: (
      cb: (data: import('./api-types').MergePrepareProgress) => void
    ): UnsubscribeFn => on('merge:prepareProgress', cb)
  },

  config: {
    get: (params: { key: string }): Promise<{ value: string | null }> =>
      ipcRenderer.invoke('config:get', params),

    set: (params: { key: string; value: string }): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('config:set', params),

    getAll: (): Promise<Record<string, string>> => ipcRenderer.invoke('config:getAll')
  },

  ai: {
    translate: (payload: AiTranslatePayload): Promise<string> =>
      ipcRenderer.invoke('ai:translate', payload),

    translateBatch: (payload: AiBatchPayload): Promise<{ jobId: string }> =>
      ipcRenderer.invoke('ai:translateBatch', payload)
  },

  promptSlot: {
    list: (): Promise<PromptSlot[]> => ipcRenderer.invoke('promptSlot:list'),

    create: (params: { name: string; prompt: string }): Promise<PromptSlot> =>
      ipcRenderer.invoke('promptSlot:create', params),

    update: (params: { id: number; name?: string; prompt?: string }): Promise<PromptSlot> =>
      ipcRenderer.invoke('promptSlot:update', params),

    delete: (params: { id: number }): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('promptSlot:delete', params)
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
  },

  metrics: {
    getUsage: (payload: { service: import('./api-types').MetricsService }) =>
      ipcRenderer.invoke('metrics:getUsage', payload),
    getAllUsage: () => ipcRenderer.invoke('metrics:getAllUsage'),
    setLimit: (payload: { service: import('./api-types').MetricsService; charLimit: number }) =>
      ipcRenderer.invoke('metrics:setLimit', payload),
    setRenewalAt: (payload: { service: import('./api-types').MetricsService; renewalAt: string }) =>
      ipcRenderer.invoke('metrics:setRenewalAt', payload),
    setConsumed: (payload: {
      service: import('./api-types').MetricsService
      consumedChars: number
    }) => ipcRenderer.invoke('metrics:setConsumed', payload),
    listRuns: (payload?: {
      limit?: number
      service?: import('./api-types').MetricsRunService
      from?: string
      to?: string
    }) => ipcRenderer.invoke('metrics:listRuns', payload),
    aggregateByDay: (payload: {
      from: string
      to: string
      service?: import('./api-types').MetricsRunService
    }) => ipcRenderer.invoke('metrics:aggregateByDay', payload),
    aggregateByMod: (payload: {
      from: string
      to: string
      service?: import('./api-types').MetricsRunService
    }) => ipcRenderer.invoke('metrics:aggregateByMod', payload)
  },

  updater: {
    getState: (): Promise<import('./api-types').UpdaterState> =>
      ipcRenderer.invoke('updater:getState'),
    check: (): Promise<import('./api-types').UpdaterState> => ipcRenderer.invoke('updater:check'),
    install: (): Promise<void> => ipcRenderer.invoke('updater:install'),
    ackChangelog: (): Promise<import('./api-types').UpdaterState> =>
      ipcRenderer.invoke('updater:ackChangelog'),
    onState: (cb: (state: import('./api-types').UpdaterState) => void): UnsubscribeFn =>
      on('updater:state', cb)
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
