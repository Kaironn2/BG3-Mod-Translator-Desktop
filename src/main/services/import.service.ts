import path from 'node:path'
import { Worker } from 'node:worker_threads'
import { app } from 'electron'
import type {
  ImportPreviewResult,
  ImportProgress,
  ImportWorkerInput
} from '../workers/import.worker.runtime'
import { resolveWorkerPath } from '../utils/worker-path'

export type { ImportPreviewResult, ImportProgress }

export type ImportProgressUpdate = Exclude<
  ImportProgress,
  { phase: 'done' } | { phase: 'error' } | { phase: 'preview-done' }
>

export interface RunImportParams {
  filePath: string
  onProgress?: (p: ImportProgressUpdate) => void
}

export function runImport(params: RunImportParams): Promise<number> {
  const { onProgress, filePath } = params
  const input: ImportWorkerInput = { filePath, dbPath: getDbPath(), mode: 'import' }

  return new Promise<number>((resolve, reject) => {
    const worker = new Worker(resolveWorkerPath(__dirname, 'import.worker.js'), { workerData: input })

    worker.on('message', (msg: ImportProgress) => {
      if (msg.phase === 'done') {
        resolve(msg.count)
        return
      }
      if (msg.phase === 'error') {
        reject(new Error(msg.message))
        return
      }
      if (msg.phase === 'preview-done') return
      onProgress?.(msg)
    })

    worker.on('error', reject)
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`import worker exited with code ${code}`))
    })
  })
}

export interface RunPreviewImportParams {
  filePath: string
  onProgress?: (p: ImportProgressUpdate) => void
}

export function runPreviewImport(params: RunPreviewImportParams): Promise<ImportPreviewResult> {
  const { onProgress, filePath } = params
  const input: ImportWorkerInput = { filePath, mode: 'preview' }

  return new Promise<ImportPreviewResult>((resolve, reject) => {
    const worker = new Worker(resolveWorkerPath(__dirname, 'import.worker.js'), { workerData: input })

    worker.on('message', (msg: ImportProgress) => {
      if (msg.phase === 'preview-done') {
        resolve(msg.result)
        return
      }
      if (msg.phase === 'error') {
        reject(new Error(msg.message))
        return
      }
      if (msg.phase === 'done') return
      onProgress?.(msg)
    })

    worker.on('error', reject)
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(`import preview worker exited with code ${code}`))
    })
  })
}

function getDbPath(): string {
  return path.join(app.getPath('userData'), 'icosa.db')
}
