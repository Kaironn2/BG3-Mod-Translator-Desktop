import { randomUUID } from 'node:crypto'
import { is } from '@electron-toolkit/utils'
import { eq } from 'drizzle-orm'
import { type BrowserWindow, ipcMain } from 'electron'
import type {
  AiBatchPayload,
  AiProviderId,
  AiTranslatePayload,
  ConfigKey,
  TranslationProvider
} from '../../preload/api-types'
import { AI_TUNING_RANGE, DEFAULT_AI_TUNING } from '../../preload/api-types'
import { getDb, getDbPath } from '../database/connection'
import type { RepositoryRegistry } from '../database/repositories/registry'
import { config } from '../database/schema'
import type { AiPipelineSimilarity } from '../pipelines/ai.pipeline'
import type { PipelineOptions } from '../pipelines/base.pipeline'
import { aiTranslate, aiTranslateGroup } from '../services/ai/ai-translate.service'
import { estimateTokens, GROUP_LIMITS, packEntriesIntoGroups } from '../services/ai/batch-grouping'
import { filterExamples } from '../services/ai/prompt-builder'
import { getProviderRateLimit } from '../services/ai/provider-limits'
import { isAiProvider, PROVIDER_CONFIG } from '../services/ai/provider-registry'
import {
  isAiLimitError,
  type RateLimitWaitInfo,
  setRateLimitWaitHandler,
  setRuntimeProviderLimits
} from '../services/ai/rate-limit'
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
import { getSimilarityClient } from '../services/similarity-client'
import { runTranslatePipeline, type TranslatePipelineParams } from '../services/translate.service'
import type { UsageService } from '../services/usage.service'
import { decodeEntities } from '../services/xml-entities.service'
import { getActiveWindow } from '../utils/window'

export type { TranslationProvider }

export interface TranslationStartPayload extends PipelineOptions {
  provider: TranslationProvider
  apiKey?: string
  model?: string
}

interface ResolvedAiConfig {
  providerId: AiProviderId
  apiKey: string
  model: string
  template: string
  similarity: AiPipelineSimilarity
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
      if (acc + e.source.length <= remaining) {
        acc += e.source.length
        allowedEntries++
      }
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
    let aiExtras: Partial<TranslatePipelineParams> = {}
    try {
      if (isAiProvider(payload.provider)) {
        const resolved = resolveAiConfig(payload.provider, repos, payload.model)
        aiExtras = {
          apiKey: resolved.apiKey,
          model: resolved.model,
          promptTemplate: resolved.template,
          similarity: resolved.similarity
        }
      } else {
        requirePayloadApiKey(payload)
      }
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
      ...aiExtras,
      provider: payload.provider,
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

  ipcMain.handle('ai:translate', async (_event, payload: AiTranslatePayload): Promise<string> => {
    try {
      const providerId = payload.provider ?? resolveActiveProvider()
      const apiKey = resolveApiKey(providerId)
      const model = resolveModel(providerId, payload.model)
      const translated = await aiTranslate({
        providerId,
        apiKey,
        model,
        template: payload.prompt,
        sourceText: payload.text,
        targetText: '',
        sourceLangName: languageName(repos, payload.sourceLang),
        targetLangName: languageName(repos, payload.targetLang),
        examples: payload.examples
      })
      return decodeEntities(translated)
    } catch (err) {
      logError('ai.translate', err, {
        provider: payload.provider,
        sourceLang: payload.sourceLang,
        targetLang: payload.targetLang
      })
      throw err
    }
  })

  ipcMain.handle(
    'ai:translateBatch',
    async (_event, payload: AiBatchPayload): Promise<{ jobId: string }> => {
      let resolved: ResolvedAiConfig
      try {
        const providerId = payload.provider ?? resolveActiveProvider()
        resolved = resolveAiConfig(providerId, repos)
      } catch (err) {
        logError('ai.translateBatch.validation', err, {
          provider: payload.provider,
          sourceLang: payload.sourceLang,
          targetLang: payload.targetLang
        })
        throw err
      }

      const jobId = randomUUID()
      const controller = new AbortController()
      activeJobs.set(jobId, { cancel: () => controller.abort() })

      void runAiBatchJob(
        { ...payload, jobId, resolved, signal: controller.signal, getWindow },
        repos
      ).finally(() => {
        activeJobs.delete(jobId)
      })

      return { jobId }
    }
  )
}

// --- AI config resolution (config table + prompt-slot repo) ---

function readConfigValue(key: ConfigKey): string | null {
  const db = getDb()
  const row = db.select().from(config).where(eq(config.key, key)).get() as
    | { key: string; value: string | null }
    | undefined
  const value = row?.value?.trim() ?? ''
  return value.length > 0 ? value : null
}

function resolveActiveProvider(): AiProviderId {
  const raw = readConfigValue('ai_provider')
  return raw && isAiProvider(raw) ? raw : 'gemini'
}

const DEV_ENV_KEYS: Partial<Record<AiProviderId, string>> = {
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  grok: 'XAI_API_KEY',
  zai: 'ZAI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY'
}

function resolveApiKey(providerId: AiProviderId): string {
  let key = readConfigValue(PROVIDER_CONFIG[providerId].keyConfigName)
  // Dev convenience: fall back to the matching .env key so testing works without Settings.
  if (!key && is.dev) {
    const envName = DEV_ENV_KEYS[providerId]
    key = (envName ? process.env[envName]?.trim() : '') || null
  }
  if (!key) {
    throw new Error(`${PROVIDER_CONFIG[providerId].label} API key not configured. Go to Settings.`)
  }
  return key
}

function resolveModel(providerId: AiProviderId, override?: string): string {
  return (
    override?.trim() ||
    readConfigValue(PROVIDER_CONFIG[providerId].modelConfigName) ||
    PROVIDER_CONFIG[providerId].defaultModel
  )
}

function resolveActiveTemplate(repos: RepositoryRegistry): string {
  const slotIdRaw = readConfigValue('ai_active_prompt_slot')
  if (slotIdRaw) {
    const id = Number(slotIdRaw)
    if (Number.isFinite(id)) {
      const slot = repos.promptSlot.getById(id)
      if (slot) return slot.prompt
    }
  }
  const fallback = repos.promptSlot.getDefault()
  if (!fallback) throw new Error('No default prompt configured')
  return fallback.prompt
}

function resolveProviderTuning(providerId: AiProviderId, model: string) {
  const base = getProviderRateLimit(providerId, model)
  const defaults = DEFAULT_AI_TUNING[providerId]
  const concurrency = clamp(
    Number.parseInt(readConfigValue(`${providerId}_concurrency`) ?? '', 10) || defaults.concurrency,
    AI_TUNING_RANGE.concurrency.min,
    AI_TUNING_RANGE.concurrency.max
  )
  const batchLines = clamp(
    Number.parseInt(readConfigValue(`${providerId}_batch_lines`) ?? '', 10) || defaults.batchLines,
    AI_TUNING_RANGE.batchLines.min,
    AI_TUNING_RANGE.batchLines.max
  )
  return {
    rateLimit: { ...base, maxConcurrent: concurrency },
    batchLines
  }
}

function resolveSimilarity(): AiPipelineSimilarity {
  const enabled = readConfigValue('ai_similarity_enabled') !== 'false'
  const count = clamp(Number.parseInt(readConfigValue('ai_similarity_count') ?? '', 10) || 3, 1, 10)
  const minScore = clampFloat(
    Number.parseFloat(readConfigValue('ai_similarity_min_score') ?? ''),
    0,
    1,
    0.35
  )
  return { enabled, count, minScore }
}

function resolveAiConfig(
  providerId: AiProviderId,
  repos: RepositoryRegistry,
  modelOverride?: string
): ResolvedAiConfig {
  return {
    providerId,
    apiKey: resolveApiKey(providerId),
    model: resolveModel(providerId, modelOverride),
    template: resolveActiveTemplate(repos),
    similarity: resolveSimilarity()
  }
}

function languageName(repos: RepositoryRegistry, code: string): string {
  return repos.language.findByCode(code)?.name ?? code
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function clampFloat(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

interface AiBatchJobContext extends AiBatchPayload {
  jobId: string
  resolved: ResolvedAiConfig
  signal: AbortSignal
  getWindow: () => BrowserWindow | null
}

async function runAiBatchJob(ctx: AiBatchJobContext, repos: RepositoryRegistry): Promise<void> {
  const summary: BatchSummary = { total: ctx.entries.length, translated: 0, failed: 0 }
  const { providerId, apiKey, model, template, similarity } = ctx.resolved

  const emitLineDone = (uid: string, translated: string): void => {
    summary.translated++
    emitBatchProgress(ctx.getWindow, {
      jobId: ctx.jobId,
      uid,
      completed: summary.translated + summary.failed,
      total: summary.total,
      target: decodeEntities(translated)
    })
  }

  const emitLineFailed = (uid: string, err: unknown): void => {
    summary.failed++
    emitBatchProgress(ctx.getWindow, {
      jobId: ctx.jobId,
      uid,
      completed: summary.translated + summary.failed,
      total: summary.total,
      target: null,
      error: err instanceof Error ? err.message : String(err)
    })
  }

  try {
    const sourceLangName = languageName(repos, ctx.sourceLang)
    const targetLangName = languageName(repos, ctx.targetLang)

    // Empty sources never reach the API - their translation is trivially empty.
    const blankEntries = ctx.entries.filter((entry) => entry.source.trim() === '')
    for (const entry of blankEntries) emitLineDone(entry.uid, '')

    const examplesByUid = new Map<string, ReturnType<typeof filterExamples>>()
    const pendingEntries = ctx.entries.filter((entry) => entry.source.trim() !== '')
    if (similarity.enabled && pendingEntries.length > 0) {
      try {
        const hits = await getSimilarityClient(getDbPath()).searchMany({
          queries: pendingEntries.map((entry) => ({ uid: entry.uid, text: entry.source })),
          sourceLang: ctx.sourceLang,
          targetLang: ctx.targetLang,
          limit: Math.max(1, similarity.count)
        })
        for (const entry of pendingEntries) {
          examplesByUid.set(
            entry.uid,
            filterExamples(hits[entry.uid] ?? [], {
              count: similarity.count,
              minScore: similarity.minScore
            })
          )
        }
      } catch (err) {
        logError('translation.batch.ai.similarity', err, {
          jobId: ctx.jobId,
          sourceLang: ctx.sourceLang,
          targetLang: ctx.targetLang
        })
        for (const entry of pendingEntries) examplesByUid.set(entry.uid, [])
      }
    } else {
      for (const entry of pendingEntries) examplesByUid.set(entry.uid, [])
    }

    // Lines are packed into token-budgeted groups so the template is sent once per group
    // instead of once per line (~95% less template overhead, ~15-20x fewer requests).
    // See services/ai/batch-grouping.ts for the budget rationale.
    const templateOverhead = estimateTokens(template) + 200 // + format/examples headings
    const tuning = resolveProviderTuning(providerId, model)
    const groups = packEntriesIntoGroups(pendingEntries, examplesByUid, templateOverhead, {
      ...GROUP_LIMITS,
      maxLines: tuning.batchLines
    })

    setRuntimeProviderLimits(providerId, { maxConcurrent: tuning.rateLimit.maxConcurrent })
    setRateLimitWaitHandler((info: RateLimitWaitInfo) => {
      emitBatchWaiting(ctx.getWindow, { jobId: ctx.jobId, ...info })
    })

    await runConcurrent(
      groups,
      tuning.rateLimit.maxConcurrent,
      async (group) => {
        throwIfAborted(ctx.signal)
        let missedUids: string[]
        try {
          const result = await aiTranslateGroup({
            providerId,
            apiKey,
            model,
            template,
            entries: group.entries,
            sourceLangName,
            targetLangName,
            examples: group.examples,
            signal: ctx.signal
          })
          for (const entry of group.entries) {
            const translated = result.translations.get(entry.uid)
            if (translated !== undefined) emitLineDone(entry.uid, translated)
          }
          missedUids = result.missedUids
          if (missedUids.length > 0) {
            logError(
              'translation.batch.ai.groupMisses',
              new Error(`Group reply missed ${missedUids.length}/${group.entries.length} lines`),
              { jobId: ctx.jobId, provider: providerId, missedUids }
            )
          }
        } catch (err) {
          if (isAbortError(err) || ctx.signal.aborted) throw err
          logError('translation.batch.ai.group', err, {
            jobId: ctx.jobId,
            provider: providerId,
            lines: group.entries.length,
            sourceLang: ctx.sourceLang,
            targetLang: ctx.targetLang
          })
          // A rate-limit/quota failure already exhausted retries. Falling back to
          // per-line requests would multiply 429s — fail the group and stop the job.
          if (isAiLimitError(err)) {
            for (const entry of group.entries) emitLineFailed(entry.uid, err)
            throw err
          }
          missedUids = group.entries.map((entry) => entry.uid)
        }

        // Per-line fallback for anything the grouped reply did not cover.
        for (const uid of missedUids) {
          throwIfAborted(ctx.signal)
          const entry = group.entries.find((e) => e.uid === uid)
          if (!entry) continue
          try {
            const translated = await aiTranslate({
              providerId,
              apiKey,
              model,
              template,
              sourceText: entry.source,
              targetText: '',
              sourceLangName,
              targetLangName,
              examples: examplesByUid.get(uid) ?? [],
              signal: ctx.signal
            })
            emitLineDone(entry.uid, translated)
          } catch (err) {
            if (isAbortError(err) || ctx.signal.aborted) throw err
            emitLineFailed(entry.uid, err)
            logError('translation.batch.ai.entry', err, {
              uid: entry.uid,
              provider: providerId,
              sourceLang: ctx.sourceLang,
              targetLang: ctx.targetLang
            })
            if (isAiLimitError(err)) throw err
          }
        }
      },
      ctx.signal
    )

    if (ctx.signal.aborted) summary.failed = summary.total - summary.translated

    emitBatchDone(ctx.getWindow, {
      jobId: ctx.jobId,
      ...summary,
      cancelled: ctx.signal.aborted
    })
  } catch (err) {
    if (isAbortError(err) || ctx.signal.aborted) {
      summary.failed = summary.total - summary.translated
      emitBatchDone(ctx.getWindow, { jobId: ctx.jobId, ...summary, cancelled: true })
      return
    }
    logError('translation.batch.ai.job', err, {
      jobId: ctx.jobId,
      provider: providerId,
      sourceLang: ctx.sourceLang,
      targetLang: ctx.targetLang,
      total: ctx.entries.length
    })
    if (isAiLimitError(err)) {
      summary.failed = summary.total - summary.translated
      if (summary.translated > 0) {
        emitBatchDone(ctx.getWindow, { jobId: ctx.jobId, ...summary, cancelled: false })
      } else {
        emitBatchError(ctx.getWindow, {
          jobId: ctx.jobId,
          message: err instanceof Error ? err.message : String(err)
        })
      }
      return
    }
    emitBatchError(ctx.getWindow, {
      jobId: ctx.jobId,
      message: err instanceof Error ? err.message : String(err)
    })
  } finally {
    setRateLimitWaitHandler(null)
    setRuntimeProviderLimits(providerId, null)
  }
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

function providerLabel(provider: TranslationProvider): string {
  if (isAiProvider(provider)) return PROVIDER_CONFIG[provider].label
  if (provider === 'deepl') return 'DeepL'
  if (provider === 'google') return 'Google'
  return 'Manual'
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

function emitBatchWaiting(
  getWindow: () => BrowserWindow | null,
  payload: { jobId: string } & RateLimitWaitInfo
): void {
  const win = getActiveWindow(getWindow)
  if (win) {
    win.webContents.send('translation:batchWaiting', payload)
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
