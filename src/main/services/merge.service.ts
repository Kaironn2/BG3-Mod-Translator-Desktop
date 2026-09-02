import path from 'node:path'
import { Worker } from 'node:worker_threads'
import { app } from 'electron'
import type { RepositoryRegistry } from '../database/repositories/registry'
import { resolveWorkerPath } from '../utils/worker-path'
import type { MergeFileInput, MergeProgress, MergeResult, MergeWorkerInput } from '../workers/merge.worker.runtime'

export type { MergeFileInput, MergeResult }

export type MergeProgressUpdate = Exclude<MergeProgress, { phase: 'done' } | { phase: 'error' }>

export interface MergeXmlsParams {
  sourceFiles: MergeFileInput[]
  sourceLang: string
  targetFiles: MergeFileInput[]
  targetLang: string
  modName: string
  onProgress?: (p: MergeProgressUpdate) => void
}

// repos is kept on the signature so the current IPC handler keeps compiling -
// task 04 drops it when it rewires merge.ipc.ts for the progress channel.
export function mergeXmls(
  _repos: RepositoryRegistry,
  params: MergeXmlsParams
): Promise<MergeResult> {
  const { onProgress, ...rest } = params
  const input: MergeWorkerInput = { ...rest, dbPath: getDbPath() }

  return new Promise<MergeResult>((resolve, reject) => {
    const worker = new Worker(resolveWorkerPath(__dirname, 'merge.worker.js'), { workerData: input })

    worker.on('message', (msg: MergeProgress) => {
      if (msg.phase === 'done') {
        resolve(msg.result)
        return
      }
      if (msg.phase === 'error') {
        reject(new Error(msg.message))
        return
      }
      onProgress?.(msg)
    })

    worker.on('error', reject)
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`merge worker exited with code ${code}`))
    })
  })
}

function getDbPath(): string {
  return path.join(app.getPath('userData'), 'icosa.db')
}
