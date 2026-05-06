import { electronAPI } from '@electron-toolkit/preload'
import type { IpcRendererEvent } from 'electron'
import { contextBridge, ipcRenderer, webUtils } from 'electron'

type UnsubscribeFn = () => void

function on<T>(channel: string, cb: (data: T) => void): UnsubscribeFn {
  const handler = (_: IpcRendererEvent, data: T): void => cb(data)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

const api = {
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
    }): Promise<void> => ipcRenderer.invoke('translation:batch', payload),

    onBatchProgress: (
      cb: (data: { uid: string; target: string | null; error?: string }) => void
    ): UnsubscribeFn => on('translation:batchProgress', cb)
  },

  dictionary: {
    getAll: (params: { lang1: string; lang2: string }) =>
      ipcRenderer.invoke('dictionary:getAll', params),

    search: (params: { text: string; lang1: string; lang2: string }) =>
      ipcRenderer.invoke('dictionary:search', params),

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

    import: (params: { filePath: string; format: 'csv' | 'xlsx' }): Promise<{ count: number }> =>
      ipcRenderer.invoke('dictionary:import', params),

    export: (params: {
      lang1: string
      lang2: string
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

    getAll: (): Promise<string[]> => ipcRenderer.invoke('mod:getAll'),

    upsert: (params: { name: string }): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('mod:upsert', params)
  },

  xml: {
    load: (params: {
      inputPath: string
      sourceLang: string
      targetLang: string
    }): Promise<
      {
        uid: string
        version: string
        source: string
        target: string
        matchType: 'none' | 'uid' | 'text' | 'manual'
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
