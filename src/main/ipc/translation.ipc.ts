import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { type BrowserWindow, ipcMain } from 'electron'
import { getDb } from '../database/connection'
import type { RepositoryRegistry } from '../database/repositories/registry'
import { config } from '../database/schema'
import type { PipelineOptions } from '../pipelines/base.pipeline'
import {
  translateText as translateDeepL,
  translateBatchDetailed as translateDeepLBatch
} from '../services/deepl.service'
import {
  translateText as translateGoogle,
  translateBatchDetailed as translateGoogleBatch
} from '../services/google.service'
import { logError } from '../services/log.service'
import { translateText as translateOpenAI } from '../services/openai.service'
import { runTranslatePipeline, type TranslatePipelineParams } from '../services/translate.service'
import type { UsageService } from '../services/usage.service'
import { decodeEntities } from '../services/xml-entities.service'
import { getActiveWindow } from '../utils/window'

export type TranslationProvider = 'openai' | 'deepl' | 'google' | 'manual'

export interface TranslationStartPayload extends PipelineOptions {
  provider: TranslationProvider
  apiKey?: string
  model?: string
}

interface BatchPayload {
  entries: { uid: string; source: string }[]
  provider: 'openai' | 'deepl' | 'google'
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
  charAcc: { value: number }
}

// Active jobs keyed by jobId - cancel() sends cancel message to the worker
const activeJobs = new Map<string, { cancel: () => void }>()

class QuotaExceededError extends Error {
  constructor(
    public readonly service: 'deepl' | 'google',
    public readonly remaining: number,
    public readonly requested: number,
    public readonly allowedEntries?: number
  ) {
    super(JSON.stringify({ code: 'QUOTA_EXCEEDED', service, remaining, requested, allowedEntries }))
    this.name = 'QuotaExceededError'
  }
}

function gateQuota(
  service: 'deepl' | 'google',
  requestedChars: number,
  usage: UsageService,
  entries?: { source: string }[]
): void {
  const remaining = usage.getRemaining(service)
  if (requestedChars <= remaining) return
  let allowedEntries: number | undefined
  if (entries) {
    let acc = 0
    allowedEntries = 0
    for (const e of entries) {
      if (acc + e.source.length > remaining) break
      acc += e.source.length
      allowedEntries++
    }
  }
  throw new QuotaExceededError(service, remaining, requestedChars, allowedEntries)
}

export function registerTranslationHandlers(
  getWindow: () => BrowserWindow | null,
  repos: RepositoryRegistry,
  usage: UsageService
): void {
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
    const startedAt = new Date().toISOString()

    const { cancel } = runTranslatePipeline({
      jobId,
      ...payload,
      provider: payload.provider as TranslatePipelineParams['provider'],
      onProgress: ({ current, total, source, target }) => {
        const win = getActiveWindow(getWindow)
        if (win) {
          win.webContents.send('translation:progress', { jobId, current, total, source, target })
        }
      },
      onDone: ({ outputPath }) => {
        activeJobs.delete(jobId)
        const finishedAt = new Date().toISOString()
        const service = payload.provider
        if (service === 'deepl' || service === 'google') {
          try {
            repos.translationRun.create({
              jobId,
              service,
              modName: payload.modName ?? null,
              sourceLang: payload.sourceLang,
              targetLang: payload.targetLang,
              entriesTotal: 0,
              entriesTranslated: 0,
              charsConsumed: 0,
              startedAt,
              finishedAt
            })
          } catch (runErr) {
            logError('translation.start.recordRun', runErr, { jobId, service })
          }
        }
        const win = getActiveWindow(getWindow)
        if (win) {
          win.webContents.send('translation:done', { jobId, outputPath })
        }
      },
      onError: ({ message }) => {
        activeJobs.delete(jobId)
        logError('translation.start.pipeline', new Error(message), {
          jobId,
          provider: payload.provider,
          sourceLang: payload.sourceLang,
          targetLang: payload.targetLang,
          modName: payload.modName
        })
        const win = getActiveWindow(getWindow)
        if (win) {
          win.webContents.send('translation:error', { jobId, message })
        }
      }
    })

    activeJobs.set(jobId, { cancel })
    return { jobId }
  })

  ipcMain.handle('translation:cancel', (_event, { jobId }: { jobId: string }) => {
    activeJobs.get(jobId)?.cancel()
    activeJobs.delete(jobId)
  })

  ipcMain.handle(
    'translation:single',
    async (
      _event,
      payload: {
        provider: 'openai' | 'deepl' | 'google'
        text: string
        sourceLang: string
        targetLang: string
      }
    ): Promise<string> => {
      try {
        const { provider, text, sourceLang, targetLang } = payload
        const apiKey = requireStoredApiKey(provider)
        if (provider === 'deepl') {
          gateQuota('deepl', text.length, usage)
          return decodeEntities(
            await translateDeepL(text, sourceLang, targetLang, apiKey, undefined, undefined, (n) =>
              usage.consume('deepl', n)
            )
          )
        }
        if (provider === 'google') {
          gateQuota('google', text.length, usage)
          return decodeEntities(
            await translateGoogle(text, sourceLang, targetLang, apiKey, undefined, (n) =>
              usage.consume('google', n)
            )
          )
        }
        return decodeEntities(await translateOpenAI(text, sourceLang, targetLang, apiKey))
      } catch (err) {
        if (err instanceof QuotaExceededError) throw err
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
    async (_event, payload: BatchPayload): Promise<{ jobId: string }> => {
      const { provider, sourceLang, targetLang, entries } = payload
      let apiKey: string
      try {
        apiKey = requireStoredApiKey(provider)
      } catch (err) {
        logError('translation.batch.validation', err, { provider, sourceLang, targetLang })
        throw err
      }

      if (provider === 'deepl' || provider === 'google') {
        const totalChars = entries.reduce((s, e) => s + e.source.length, 0)
        try {
          gateQuota(provider, totalChars, usage, entries)
        } catch (err) {
          if (err instanceof QuotaExceededError) throw err
          throw err
        }
      }

      const jobId = randomUUID()
      const controller = new AbortController()
      const charAcc = { value: 0 }
      activeJobs.set(jobId, { cancel: () => controller.abort() })

      void runBatchJob(
        {
          ...payload,
          jobId,
          apiKey,
          signal: controller.signal,
          getWindow,
          charAcc
        },
        repos,
        usage
      ).finally(() => {
        activeJobs.delete(jobId)
      })

      return { jobId }
    }
  )
}

function readApiKey(provider: 'openai' | 'deepl' | 'google'): string | null {
  const db = getDb()
  const key =
    provider === 'deepl' ? 'deepl_key' : provider === 'google' ? 'google_key' : 'openai_key'
  const row = db.select().from(config).where(eq(config.key, key)).get() as
    | { key: string; value: string | null }
    | undefined
  const value = row?.value?.trim() ?? ''
  return value.length > 0 ? value : null
}

function requireStoredApiKey(provider: 'openai' | 'deepl' | 'google'): string {
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

function providerLabel(provider: 'openai' | 'deepl' | 'google'): string {
  if (provider === 'deepl') return 'DeepL'
  if (provider === 'google') return 'Google'
  return 'OpenAI'
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

async function runBatchJob(
  ctx: BatchJobContext,
  repos: RepositoryRegistry,
  usage: UsageService
): Promise<void> {
  const summary: BatchSummary = {
    total: ctx.entries.length,
    translated: 0,
    failed: 0
  }
  const startedAt = new Date().toISOString()

  try {
    if (ctx.provider === 'deepl') {
      await runDeepLBatchJob(ctx, summary, usage)
    } else if (ctx.provider === 'google') {
      await runGoogleBatchJob(ctx, summary, usage)
    } else {
      await runOpenAIBatchJob(ctx, summary)
    }

    if (ctx.signal.aborted) {
      summary.failed = summary.total - summary.translated
    }

    if (ctx.provider === 'deepl' || ctx.provider === 'google') {
      try {
        repos.translationRun.create({
          jobId: ctx.jobId,
          service: ctx.provider,
          modName: null,
          sourceLang: ctx.sourceLang,
          targetLang: ctx.targetLang,
          entriesTotal: summary.total,
          entriesTranslated: summary.translated,
          charsConsumed: ctx.charAcc.value,
          startedAt,
          finishedAt: new Date().toISOString()
        })
      } catch (runErr) {
        logError('translation.batch.recordRun', runErr, {
          jobId: ctx.jobId,
          provider: ctx.provider
        })
      }
    }

    emitBatchDone(ctx.getWindow, {
      jobId: ctx.jobId,
      ...summary,
      cancelled: ctx.signal.aborted
    })
  } catch (err) {
    if (isAbortError(err) || ctx.signal.aborted) {
      summary.failed = summary.total - summary.translated

      if (ctx.provider === 'deepl' || ctx.provider === 'google') {
        try {
          repos.translationRun.create({
            jobId: ctx.jobId,
            service: ctx.provider,
            modName: null,
            sourceLang: ctx.sourceLang,
            targetLang: ctx.targetLang,
            entriesTotal: summary.total,
            entriesTranslated: summary.translated,
            charsConsumed: ctx.charAcc.value,
            startedAt,
            finishedAt: new Date().toISOString()
          })
        } catch (runErr) {
          logError('translation.batch.recordRun.cancelled', runErr, {
            jobId: ctx.jobId,
            provider: ctx.provider
          })
        }
      }

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

async function runDeepLBatchJob(
  ctx: BatchJobContext,
  summary: BatchSummary,
  usage: UsageService
): Promise<void> {
  let pendingEntries = [...ctx.entries]

  while (pendingEntries.length > 0) {
    throwIfAborted(ctx.signal)

    const results = await translateDeepLBatch(
      pendingEntries.map((entry) => entry.source),
      ctx.sourceLang,
      ctx.targetLang,
      ctx.apiKey,
      ctx.signal,
      (n) => {
        ctx.charAcc.value += n
        usage.consume('deepl', n)
      }
    )

    let roundSuccesses = 0
    const nextPending: Array<{ entry: BatchPayload['entries'][number]; error?: string }> = []

    for (const result of results) {
      const entry = pendingEntries[result.index]
      if (!entry) continue

      if (result.translated != null) {
        roundSuccesses++
        summary.translated++
        emitBatchProgress(ctx.getWindow, {
          jobId: ctx.jobId,
          uid: entry.uid,
          completed: summary.translated + summary.failed,
          total: summary.total,
          target: decodeEntities(result.translated)
        })
        continue
      }

      nextPending.push({ entry, error: result.error })
    }

    if (nextPending.length === 0) {
      summary.failed = 0
      return
    }

    if (roundSuccesses === 0) {
      for (const pending of nextPending) {
        summary.failed++
        logError(
          'translation.batch.deepl.entry',
          new Error(pending.error ?? 'DeepL batch entry failed'),
          {
            jobId: ctx.jobId,
            uid: pending.entry.uid,
            sourceLang: ctx.sourceLang,
            targetLang: ctx.targetLang,
            source: pending.entry.source
          }
        )
        emitBatchProgress(ctx.getWindow, {
          jobId: ctx.jobId,
          uid: pending.entry.uid,
          completed: summary.translated + summary.failed,
          total: summary.total,
          target: null,
          error: pending.error
        })
      }
      return
    }

    pendingEntries = nextPending.map((pending) => pending.entry)
  }
}

async function runGoogleBatchJob(
  ctx: BatchJobContext,
  summary: BatchSummary,
  usage: UsageService
): Promise<void> {
  let pendingEntries = [...ctx.entries]

  while (pendingEntries.length > 0) {
    throwIfAborted(ctx.signal)

    const results = await translateGoogleBatch(
      pendingEntries.map((entry) => entry.source),
      ctx.sourceLang,
      ctx.targetLang,
      ctx.apiKey,
      ctx.signal,
      (n) => {
        ctx.charAcc.value += n
        usage.consume('google', n)
      }
    )

    let roundSuccesses = 0
    const nextPending: Array<{ entry: BatchPayload['entries'][number]; error?: string }> = []

    for (const result of results) {
      const entry = pendingEntries[result.index]
      if (!entry) continue

      if (result.translated != null) {
        roundSuccesses++
        summary.translated++
        emitBatchProgress(ctx.getWindow, {
          jobId: ctx.jobId,
          uid: entry.uid,
          completed: summary.translated + summary.failed,
          total: summary.total,
          target: decodeEntities(result.translated)
        })
        continue
      }

      nextPending.push({ entry, error: result.error })
    }

    if (nextPending.length === 0) {
      summary.failed = 0
      return
    }

    if (roundSuccesses === 0) {
      for (const pending of nextPending) {
        summary.failed++
        logError(
          'translation.batch.google.entry',
          new Error(pending.error ?? 'Google batch entry failed'),
          {
            jobId: ctx.jobId,
            uid: pending.entry.uid,
            sourceLang: ctx.sourceLang,
            targetLang: ctx.targetLang,
            source: pending.entry.source
          }
        )
        emitBatchProgress(ctx.getWindow, {
          jobId: ctx.jobId,
          uid: pending.entry.uid,
          completed: summary.translated + summary.failed,
          total: summary.total,
          target: null,
          error: pending.error
        })
      }
      return
    }

    pendingEntries = nextPending.map((pending) => pending.entry)
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
          completed: summary.translated + summary.failed,
          total: summary.total,
          target: decodeEntities(translated)
        })
      } catch (err) {
        if (isAbortError(err) || ctx.signal.aborted) throw err

        summary.failed++
        emitBatchProgress(ctx.getWindow, {
          jobId: ctx.jobId,
          uid: entry.uid,
          completed: summary.translated + summary.failed,
          total: summary.total,
          target: null,
          error: err instanceof Error ? err.message : String(err)
        })
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
  payload: {
    jobId: string
    uid: string
    completed: number
    total: number
    target: string | null
    error?: string
  }
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
  return (
    err instanceof Error && (err.name === 'AbortError' || err.message === 'Translation cancelled')
  )
}
