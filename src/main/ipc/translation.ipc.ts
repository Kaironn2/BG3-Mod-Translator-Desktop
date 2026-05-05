import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { type BrowserWindow, ipcMain } from 'electron'
import { getDb } from '../database/connection'
import { config } from '../database/schema'
import type { BasePipeline, PipelineOptions } from '../pipelines/base.pipeline'
import { DeepLPipeline } from '../pipelines/deepl.pipeline'
import { ManualPipeline } from '../pipelines/manual.pipeline'
import { OpenAIPipeline } from '../pipelines/openai.pipeline'
import { translateText as translateDeepL } from '../services/deepl.service'
import { translateText as translateOpenAI } from '../services/openai.service'

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

  ipcMain.handle(
    'translation:single',
    async (
      _event,
      payload: {
        provider: 'openai' | 'deepl'
        text: string
        sourceLang: string
        targetLang: string
      }
    ): Promise<string> => {
      const { provider, text, sourceLang, targetLang } = payload
      const apiKey = readApiKey(provider)
      if (!provider) throw new Error(`Unknown provider`)
      if (!apiKey)
        throw new Error(
          `${provider === 'deepl' ? 'DeepL' : 'OpenAI'} API key not configured. Go to Settings.`
        )
      if (provider === 'deepl') return translateDeepL(text, sourceLang, targetLang, apiKey)
      return translateOpenAI(text, sourceLang, targetLang, apiKey)
    }
  )

  ipcMain.handle(
    'translation:batch',
    async (
      _event,
      payload: {
        entries: { uid: string; source: string }[]
        provider: 'openai' | 'deepl'
        sourceLang: string
        targetLang: string
      }
    ): Promise<void> => {
      const { entries, provider, sourceLang, targetLang } = payload
      const apiKey = readApiKey(provider)
      if (!apiKey) {
        const win = getWindow()
        if (win && !win.isDestroyed()) {
          win.webContents.send('translation:batchProgress', {
            uid: '',
            target: null,
            error: `${provider === 'deepl' ? 'DeepL' : 'OpenAI'} API key not configured. Go to Settings.`
          })
        }
        return
      }

      for (const entry of entries) {
        try {
          const translated =
            provider === 'deepl'
              ? await translateDeepL(entry.source, sourceLang, targetLang, apiKey)
              : await translateOpenAI(entry.source, sourceLang, targetLang, apiKey)
          const win = getWindow()
          if (win && !win.isDestroyed()) {
            win.webContents.send('translation:batchProgress', {
              uid: entry.uid,
              target: translated
            })
          }
        } catch (err) {
          const win = getWindow()
          if (win && !win.isDestroyed()) {
            win.webContents.send('translation:batchProgress', {
              uid: entry.uid,
              target: null,
              error: err instanceof Error ? err.message : String(err)
            })
          }
        }
      }
    }
  )
}

function readApiKey(provider: 'openai' | 'deepl'): string | null {
  const db = getDb()
  const key = provider === 'deepl' ? 'deepl_key' : 'openai_key'
  const row = db.select().from(config).where(eq(config.key, key)).get() as
    | { key: string; value: string | null }
    | undefined
  return row?.value ?? null
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
