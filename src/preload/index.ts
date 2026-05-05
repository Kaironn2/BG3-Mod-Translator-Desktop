import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { IpcRendererEvent } from 'electron'

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
      on('translation:error', cb)
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
    }): Promise<{ success: boolean; pakPath: string }> => ipcRenderer.invoke('mod:pack', params)
  },

  config: {
    get: (params: { key: string }): Promise<{ value: string | null }> =>
      ipcRenderer.invoke('config:get', params),

    set: (params: { key: string; value: string }): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('config:set', params),

    getAll: (): Promise<Record<string, string>> => ipcRenderer.invoke('config:getAll')
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

    openFolder: (): Promise<string | null> => ipcRenderer.invoke('fs:openFolder')
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
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
