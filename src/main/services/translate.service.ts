import path from 'node:path'
import { Worker } from 'node:worker_threads'
import { app } from 'electron'
import type { TranslationProvider } from '../../preload/api-types'
import type { AiPipelineSimilarity } from '../pipelines/ai.pipeline'
import { resolveWorkerPath } from '../utils/worker-path'
import type {
  TranslateWorkerInput,
  TranslateWorkerProgress
} from '../workers/translate.worker.runtime'

export interface TranslatePipelineParams {
  jobId: string
  filePath: string
  modName: string
  sourceLang: string
  targetLang: string
  author?: string
  provider: TranslationProvider
  apiKey?: string
  model?: string
  promptTemplate?: string
  similarity?: AiPipelineSimilarity
  onProgress: (p: { current: number; total: number; source: string; target: string }) => void
  onDone: (p: { outputPath: string }) => void
  onError: (p: { message: string }) => void
}

export function runTranslatePipeline(params: TranslatePipelineParams): { cancel: () => void } {
  const { onProgress, onDone, onError, ...rest } = params
  const input: TranslateWorkerInput = {
    ...rest,
    dbPath: path.join(app.getPath('userData'), 'icosa.db')
  }

  let settled = false
  const worker = new Worker(resolveWorkerPath(__dirname, 'translate.worker.js'), { workerData: input })

  worker.on('message', (msg: TranslateWorkerProgress) => {
    if (msg.phase === 'progress') {
      onProgress({ current: msg.current, total: msg.total, source: msg.source, target: msg.target })
    } else if (msg.phase === 'done') {
      settled = true
      worker.removeAllListeners()
      onDone({ outputPath: msg.outputPath })
    } else if (msg.phase === 'error') {
      settled = true
      worker.removeAllListeners()
      onError({ message: msg.message })
    }
  })

  worker.on('error', (err) => {
    if (!settled) {
      settled = true
      onError({ message: err.message })
    }
  })

  worker.on('exit', (code) => {
    if (code !== 0 && !settled) {
      settled = true
      onError({ message: `translate worker exited with code ${code}` })
    }
  })

  return {
    cancel: () => {
      worker.postMessage({ type: 'cancel' })
      const t = setTimeout(() => worker.terminate(), 5000)
      worker.once('exit', () => clearTimeout(t))
    }
  }
}
