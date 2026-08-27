import path from 'node:path'
import { Worker } from 'node:worker_threads'
import { app } from 'electron'
import type {
  DeleteJob,
  DeleteProgress,
  DeleteWorkerInput,
  DeleteWorkerResult
} from '../workers/delete.worker.runtime'

export type { DeleteWorkerResult }
export type DeleteProgressUpdate = Exclude<DeleteProgress, { phase: 'done' } | { phase: 'error' }>

export interface RunDeleteParams {
  job: DeleteJob
  modsRoot?: string
  chunkSize?: number
  onProgress?: (p: DeleteProgressUpdate) => void
}

let activeDelete: Promise<unknown> | null = null

export function isDeleteRunning(): boolean {
  return activeDelete != null
}

export function runDelete(params: RunDeleteParams): Promise<DeleteWorkerResult> {
  if (activeDelete) {
    return Promise.reject(new Error('A delete is already in progress'))
  }

  const input: DeleteWorkerInput = {
    dbPath: getDbPath(),
    job: params.job,
    modsRoot: params.modsRoot,
    chunkSize: params.chunkSize
  }

  const work = new Promise<DeleteWorkerResult>((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'delete.worker.js'), { workerData: input })

    worker.on('message', (msg: DeleteProgress) => {
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
      if (code !== 0) reject(new Error(`delete worker exited with code ${code}`))
    })
  })

  activeDelete = work.finally(() => {
    activeDelete = null
  })

  return work
}

export function getStoredModsRoot(): string {
  return path.join(app.getPath('userData'), 'icosa', 'mods')
}

function getDbPath(): string {
  return path.join(app.getPath('userData'), 'icosa.db')
}
