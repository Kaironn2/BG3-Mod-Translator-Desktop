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

interface BatchPayload {
  entries: { uid: string; source: string }[]
  provider: 'openai' | 'deepl'
  sourceLang: string
  targetLang: string
}

interface BatchSummary {
  total: number
  translated: number
  failed: number
}

interface BatchJobContext extends BatchPayload {
  jobId: string
  apiKey: string
  signal: AbortSignal
  getWindow: () => BrowserWindow | null
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
      payload: BatchPayload
    ): Promise<{ jobId: string }> => {
      const { provider, sourceLang, targetLang } = payload
      let apiKey: string
      try {
        apiKey = requireStoredApiKey(provider)
      } catch (err) {
        logError('translation.batch.validation', err, { provider, sourceLang, targetLang })
        throw err
      }

      const jobId = randomUUID()
      const controller = new AbortController()
      activeJobs.set(jobId, controller)

      void runBatchJob({
        ...payload,
        jobId,
        apiKey,
        signal: controller.signal,
        getWindow
      }).finally(() => {
        activeJobs.delete(jobId)
      })

      return { jobId }
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
  fn: (item: T) => Promise<void>,
  signal?: AbortSignal
): Promise<void> {
  let index = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      throwIfAborted(signal)
      const item = items[index++]
      await fn(item)
    }
  })
  await Promise.all(workers)
}

async function runBatchJob(ctx: BatchJobContext): Promise<void> {
  const summary: BatchSummary = {
    total: ctx.entries.length,
    translated: 0,
    failed: 0
  }

  try {
    if (ctx.provider === 'deepl') {
      await runDeepLBatchJob(ctx, summary)
    } else {
      await runOpenAIBatchJob(ctx, summary)
    }

    if (ctx.signal.aborted) {
      summary.failed = summary.total - summary.translated
    }

    emitBatchDone(ctx.getWindow, {
      jobId: ctx.jobId,
      ...summary,
      cancelled: ctx.signal.aborted
    })
  } catch (err) {
    if (isAbortError(err) || ctx.signal.aborted) {
      summary.failed = summary.total - summary.translated
      emitBatchDone(ctx.getWindow, {
        jobId: ctx.jobId,
        ...summary,
        cancelled: true
      })
      return
    }

    logError('translation.batch.job', err, {
      jobId: ctx.jobId,
      provider: ctx.provider,
      sourceLang: ctx.sourceLang,
      targetLang: ctx.targetLang,
      total: ctx.entries.length
    })
    emitBatchError(ctx.getWindow, {
      jobId: ctx.jobId,
      message: err instanceof Error ? err.message : String(err)
    })
  }
}

async function runDeepLBatchJob(ctx: BatchJobContext, summary: BatchSummary): Promise<void> {
  let pendingEntries = [...ctx.entries]

  while (pendingEntries.length > 0) {
    throwIfAborted(ctx.signal)

    const results = await translateDeepLBatch(
      pendingEntries.map((entry) => entry.source),
      ctx.sourceLang,
      ctx.targetLang,
      ctx.apiKey,
      ctx.signal
    )

    let roundSuccesses = 0
    const nextPending: BatchPayload['entries'] = []

    for (const result of results) {
      const entry = pendingEntries[result.index]
      if (!entry) continue

      if (result.translated != null) {
        roundSuccesses++
        summary.translated++
        emitBatchProgress(ctx.getWindow, {
          jobId: ctx.jobId,
          uid: entry.uid,
          target: result.translated
        })
        continue
      }

      nextPending.push(entry)
    }

    if (nextPending.length === 0) {
      summary.failed = 0
      return
    }

    if (roundSuccesses === 0) {
      summary.failed = nextPending.length
      return
    }

    pendingEntries = nextPending
  }
}

async function runOpenAIBatchJob(ctx: BatchJobContext, summary: BatchSummary): Promise<void> {
  await runConcurrent(
    ctx.entries,
    10,
    async (entry) => {
      throwIfAborted(ctx.signal)

      try {
        const translated = await translateOpenAI(
          entry.source,
          ctx.sourceLang,
          ctx.targetLang,
          ctx.apiKey,
          [],
          'gpt-4o-mini',
          ctx.signal
        )
        summary.translated++
        emitBatchProgress(ctx.getWindow, {
          jobId: ctx.jobId,
          uid: entry.uid,
          target: translated
        })
      } catch (err) {
        if (isAbortError(err) || ctx.signal.aborted) throw err

        summary.failed++
        logError('translation.batch.openai.entry', err, {
          uid: entry.uid,
          sourceLang: ctx.sourceLang,
          targetLang: ctx.targetLang
        })
      }
    },
    ctx.signal
  )
}

function emitBatchProgress(
  getWindow: () => BrowserWindow | null,
  payload: { jobId: string; uid: string; target: string | null; error?: string }
): void {
  const win = getActiveWindow(getWindow)
  if (win) {
    win.webContents.send('translation:batchProgress', payload)
  }
}

function emitBatchDone(
  getWindow: () => BrowserWindow | null,
  payload: {
    jobId: string
    total: number
    translated: number
    failed: number
    cancelled: boolean
  }
): void {
  const win = getActiveWindow(getWindow)
  if (win) {
    win.webContents.send('translation:batchDone', payload)
  }
}

function emitBatchError(
  getWindow: () => BrowserWindow | null,
  payload: { jobId: string; message: string }
): void {
  const win = getActiveWindow(getWindow)
  if (win) {
    win.webContents.send('translation:batchError', payload)
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw signal.reason ?? new Error('Translation cancelled')
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || err.message === 'Translation cancelled')
}
