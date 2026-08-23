import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import type { TranslationProvider } from '../../preload/api-types'
import * as schema from '../database/schema'
import { applySqlitePragmas } from '../database/sqlite-pragmas'
import { AIPipeline, type AiPipelineSimilarity } from '../pipelines/ai.pipeline'
import type { BasePipeline } from '../pipelines/base.pipeline'
import { DeepLPipeline } from '../pipelines/deepl.pipeline'
import { GooglePipeline } from '../pipelines/google.pipeline'
import { ManualPipeline } from '../pipelines/manual.pipeline'
import { isAiProvider, PROVIDER_CONFIG } from '../services/ai/provider-registry'

export interface TranslateWorkerInput {
  jobId: string
  provider: TranslationProvider
  apiKey?: string
  model?: string
  promptTemplate?: string
  similarity?: AiPipelineSimilarity
  filePath: string
  modName: string
  sourceLang: string
  targetLang: string
  author?: string
  dbPath: string
}

export type TranslateWorkerProgress =
  | { phase: 'progress'; current: number; total: number; source: string; target: string }
  | { phase: 'done'; outputPath: string }
  | { phase: 'error'; message: string }

const DEFAULT_SIMILARITY: AiPipelineSimilarity = { enabled: false, count: 3, minScore: 0.35 }

function buildPipeline(input: TranslateWorkerInput): BasePipeline {
  const provider = input.provider

  if (isAiProvider(provider)) {
    if (!input.apiKey) throw new Error(`${PROVIDER_CONFIG[provider].label} API key is required`)
    if (!input.promptTemplate) throw new Error('Prompt template is required for AI translation')
    const model = input.model || PROVIDER_CONFIG[provider].defaultModel
    return new AIPipeline(
      provider,
      input.apiKey,
      model,
      input.promptTemplate,
      input.similarity ?? DEFAULT_SIMILARITY
    )
  }

  switch (provider) {
    case 'deepl':
      if (!input.apiKey) throw new Error('DeepL API key is required')
      return new DeepLPipeline(input.apiKey)
    case 'google':
      if (!input.apiKey) throw new Error('Google Translate API key is required')
      return new GooglePipeline(input.apiKey)
    case 'manual':
      return new ManualPipeline()
    default:
      throw new Error(`Unknown translation provider: ${provider}`)
  }
}

export async function runTranslateWorker(
  input: TranslateWorkerInput,
  post: (msg: TranslateWorkerProgress) => void,
  receiveCancel: (handler: () => void) => void
): Promise<void> {
  const controller = new AbortController()
  receiveCancel(() => controller.abort())

  const sqlite = new Database(input.dbPath)
  applySqlitePragmas(sqlite)

  try {
    const db = drizzle(sqlite, { schema })
    const pipeline = buildPipeline(input)

    await pipeline.run({
      jobId: input.jobId,
      filePath: input.filePath,
      modName: input.modName,
      sourceLang: input.sourceLang,
      targetLang: input.targetLang,
      author: input.author,
      signal: controller.signal,
      db,
      onProgress: (current, total, source, target) =>
        post({ phase: 'progress', current, total, source, target }),
      onDone: (outputPath) => post({ phase: 'done', outputPath })
    })
  } finally {
    sqlite.close()
  }
}
