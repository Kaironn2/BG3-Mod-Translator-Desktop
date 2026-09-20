import path from 'node:path'
import { Worker } from 'node:worker_threads'
import { app } from 'electron'
import { resolveWorkerPath } from '../utils/worker-path'
import type {
  ReplaceJob,
  ReplaceProgress,
  ReplaceWorkerInput,
  ReplaceWorkerResult
} from '../workers/replace.worker.runtime'

export type { ReplaceWorkerResult }
export type ReplaceProgressUpdate = Exclude<ReplaceProgress, { phase: 'done' } | { phase: 'error' }>

export interface RunReplaceParams {
  job: ReplaceJob
  chunkSize?: number
  onProgress?: (p: ReplaceProgressUpdate) => void
}

let activeReplace: Promise<unknown> | null = null

export function isReplaceRunning(): boolean {
  return activeReplace != null
}

export function runReplace(params: RunReplaceParams): Promise<ReplaceWorkerResult> {
  if (activeReplace) {
    return Promise.reject(new Error('A replace is already in progress'))
  }

  const input: ReplaceWorkerInput = {
    dbPath: path.join(app.getPath('userData'), 'icosa.db'),
    job: params.job,
    chunkSize: params.chunkSize
  }

  const work = new Promise<ReplaceWorkerResult>((resolve, reject) => {
    const worker = new Worker(resolveWorkerPath(__dirname, 'replace.worker.js'), {
      workerData: input
    })

    worker.on('message', (msg: ReplaceProgress) => {
      if (msg.phase === 'done') {
        resolve(msg.result)
        return
      }
      if (msg.phase === 'error') {
        reject(new Error(msg.message))
        return
      }
      params.onProgress?.(msg)
    })

    worker.on('error', reject)
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`replace worker exited with code ${code}`))
    })
  })

  activeReplace = work.finally(() => {
    activeReplace = null
  })

  return work
}
