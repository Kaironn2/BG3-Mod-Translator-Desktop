import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { type BrowserWindow, ipcMain } from 'electron'
import { getDb } from '../database/connection'
import { config } from '../database/schema'
import type { BasePipeline, PipelineOptions } from '../pipelines/base.pipeline'
import { DeepLPipeline } from '../pipelines/deepl.pipeline'
import { ManualPipeline } from '../pipelines/manual.pipeline'
import { OpenAIPipeline } from '../pipelines/openai.pipeline'
import {
  translateBatchDetailed as translateDeepLBatch,
  translateText as translateDeepL
} from '../services/deepl.service'
import { logError } from '../services/log.service'
import { translateText as translateOpenAI } from '../services/openai.service'
import { getActiveWindow } from '../utils/window'

export type TranslationProvider = 'openai' | 'deepl' | 'manual'

export interface TranslationStartPayload extends PipelineOptions {
  provider: TranslationProvider
  apiKey?: string
  model?: string
}

interface BatchSummary {
  total: number
  translated: number
  failed: number
}

// Active jobs keyed by jobId - AbortController allows cancellation
const activeJobs = new Map<string, AbortController>()

export function registerTranslationHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('translation:start', async (_event, payload: TranslationStartPayload) => {
    try {
      requirePayloadApiKey(payload)
    } catch (err) {
      logError('translation.start.validation', err, {
        provider: payload.provider,
        sourceLang: payload.sourceLang,
        targetLang: payload.targetLang,
        modName: payload.modName
      })
      throw err
    }
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
        logError('translation.start.pipeline', err, {
          jobId,
          provider: payload.provider,
          sourceLang: payload.sourceLang,
          targetLang: payload.targetLang,
          modName: payload.modName
        })
        const win = getActiveWindow(getWindow)
        if (win) {
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
      try {
        const { provider, text, sourceLang, targetLang } = payload
        const apiKey = requireStoredApiKey(provider)
        if (provider === 'deepl') return translateDeepL(text, sourceLang, targetLang, apiKey)
        return translateOpenAI(text, sourceLang, targetLang, apiKey)
      } catch (err) {
        logError('translation.single', err, {
          provider: payload.provider,
          sourceLang: payload.sourceLang,
          targetLang: payload.targetLang
        })
        throw err
      }
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
    ): Promise<BatchSummary> => {
      const { entries, provider, sourceLang, targetLang } = payload
      const summary: BatchSummary = { total: entries.length, translated: 0, failed: 0 }
      let apiKey: string
      try {
        apiKey = requireStoredApiKey(provider)
      } catch (err) {
        logError('translation.batch.validation', err, { provider, sourceLang, targetLang })
        throw err
      }

      if (provider === 'deepl') {
        const texts = entries.map((e) => e.source)
        const results = await translateDeepLBatch(texts, sourceLang, targetLang, apiKey)
        const win = getActiveWindow(getWindow)
        for (const result of results) {
          const entry = entries[result.index]
          if (!entry) continue
          if (result.translated != null) {
            summary.translated++
            if (win) {
              win.webContents.send('translation:batchProgress', {
                uid: entry.uid,
                target: result.translated
              })
            }
          } else {
            summary.failed++
            const error = result.error ?? 'DeepL translation failed'
            if (win) {
              win.webContents.send('translation:batchProgress', {
                uid: entry.uid,
                target: null,
                error
              })
            }
          }
        }
      } else {
        // OpenAI: parallel worker pool (10 concurrent requests)
        await runConcurrent(entries, 10, async (entry) => {
          try {
            const translated = await translateOpenAI(entry.source, sourceLang, targetLang, apiKey)
            summary.translated++
            const win = getActiveWindow(getWindow)
            if (win) {
              win.webContents.send('translation:batchProgress', {
                uid: entry.uid,
                target: translated
              })
            }
          } catch (err) {
            summary.failed++
            logError('translation.batch.openai.entry', err, {
              uid: entry.uid,
              sourceLang,
              targetLang
            })
            const win = getActiveWindow(getWindow)
            if (win) {
              win.webContents.send('translation:batchProgress', {
                uid: entry.uid,
                target: null,
                error: err instanceof Error ? err.message : String(err)
              })
            }
          }
        })
      }

      return summary
    }
  )
}

function readApiKey(provider: 'openai' | 'deepl'): string | null {
  const db = getDb()
  const key = provider === 'deepl' ? 'deepl_key' : 'openai_key'
  const row = db.select().from(config).where(eq(config.key, key)).get() as
    | { key: string; value: string | null }
    | undefined
  const value = row?.value?.trim() ?? ''
  return value.length > 0 ? value : null
}

function requireStoredApiKey(provider: 'openai' | 'deepl'): string {
  const apiKey = readApiKey(provider)
  if (!apiKey) throw new Error(`${providerLabel(provider)} API key not configured. Go to Settings.`)
  return apiKey
}

function requirePayloadApiKey(payload: TranslationStartPayload): void {
  if (payload.provider === 'manual') return
  if (!payload.apiKey?.trim()) {
    throw new Error(`${providerLabel(payload.provider)} API key is required`)
  }
}

function providerLabel(provider: 'openai' | 'deepl'): string {
  return provider === 'deepl' ? 'DeepL' : 'OpenAI'
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

// Worker pool: runs fn over items with at most `concurrency` parallel executions
async function runConcurrent<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  let index = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++]
      await fn(item)
    }
  })
  await Promise.all(workers)
}
