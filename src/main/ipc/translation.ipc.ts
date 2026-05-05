import { ipcMain, BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'

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

// Active jobs keyed by jobId - AbortController allows cancellation
const activeJobs = new Map<string, AbortController>()

export function registerTranslationHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('translation:start', async (_event, payload: TranslationStartPayload) => {
    const jobId = randomUUID()
    const controller = new AbortController()
    activeJobs.set(jobId, controller)

    runPipeline(jobId, payload, controller.signal, getWindow)
      .then(() => {
        activeJobs.delete(jobId)
      })
      .catch((err: Error) => {
        activeJobs.delete(jobId)
        const win = getWindow()
        if (win && !win.isDestroyed()) {
          win.webContents.send('translation:error', {
            jobId,
            message: err.message ?? String(err)
          })
        }
      })

    return { jobId }
  })

  ipcMain.handle('translation:cancel', (_event, { jobId }: { jobId: string }) => {
    activeJobs.get(jobId)?.abort()
    activeJobs.delete(jobId)
  })
}

// Placeholder - real pipeline calls will be wired in Phase 3
async function runPipeline(
  _jobId: string,
  payload: TranslationStartPayload,
  _signal: AbortSignal,
  _getWindow: () => BrowserWindow | null
): Promise<void> {
  throw new Error(`Pipeline '${payload.provider}' is not yet implemented (Phase 3)`)
}
