import { ipcMain, BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import { DeepLPipeline } from '../pipelines/deepl.pipeline'
import { OpenAIPipeline } from '../pipelines/openai.pipeline'
import { ManualPipeline } from '../pipelines/manual.pipeline'
import type { BasePipeline, PipelineOptions } from '../pipelines/base.pipeline'

export type TranslationProvider = 'openai' | 'deepl' | 'manual'

export interface TranslationStartPayload extends PipelineOptions {
  provider: TranslationProvider
  apiKey?: string
  model?: string
}

// Active jobs keyed by jobId - AbortController allows cancellation
const activeJobs = new Map<string, AbortController>()

export function registerTranslationHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('translation:start', async (_event, payload: TranslationStartPayload) => {
    const jobId = randomUUID()
    const controller = new AbortController()
    activeJobs.set(jobId, controller)

    const pipeline = buildPipeline(payload)

    pipeline
      .run({
        jobId,
        signal: controller.signal,
        getWindow,
        filePath: payload.filePath,
        modName: payload.modName,
        sourceLang: payload.sourceLang,
        targetLang: payload.targetLang,
        author: payload.author
      })
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

function buildPipeline(payload: TranslationStartPayload): BasePipeline {
  switch (payload.provider) {
    case 'deepl':
      if (!payload.apiKey) throw new Error('DeepL API key is required')
      return new DeepLPipeline(payload.apiKey)

    case 'openai':
      if (!payload.apiKey) throw new Error('OpenAI API key is required')
      return new OpenAIPipeline(payload.apiKey, payload.model)

    case 'manual':
      return new ManualPipeline()

    default:
      throw new Error(`Unknown translation provider: ${payload.provider}`)
  }
}
