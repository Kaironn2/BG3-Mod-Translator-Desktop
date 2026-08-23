import path from 'node:path'
import { Worker } from 'node:worker_threads'
import type { SimilarEntry } from './similarity.service'

interface Pending<T> {
  resolve: (value: T) => void
  reject: (err: Error) => void
}

export interface SimilarSearchQuery {
  uid: string
  text: string
}

export class SimilarityClient {
  private worker: Worker | null = null
  private pending = new Map<number, Pending<unknown>>()
  private nextId = 1
  private ready: Promise<void> | null = null

  constructor(private readonly dbPath: string) {}

  async search(params: {
    text: string
    sourceLang: string
    targetLang: string
    limit?: number
  }): Promise<SimilarEntry[]> {
    await this.ensureReady()
    const requestId = this.nextId++
    const result = this.register<SimilarEntry[]>(requestId)
    this.workerOrThrow().postMessage({
      type: 'search',
      requestId,
      sourceLang: params.sourceLang,
      targetLang: params.targetLang,
      text: params.text,
      limit: params.limit ?? 5
    })
    return result
  }

  async searchMany(params: {
    queries: SimilarSearchQuery[]
    sourceLang: string
    targetLang: string
    limit?: number
  }): Promise<Record<string, SimilarEntry[]>> {
    if (params.queries.length === 0) return {}
    await this.ensureReady()
    const requestId = this.nextId++
    const result = this.register<Record<string, SimilarEntry[]>>(requestId)
    this.workerOrThrow().postMessage({
      type: 'searchMany',
      requestId,
      sourceLang: params.sourceLang,
      targetLang: params.targetLang,
      queries: params.queries,
      limit: params.limit ?? 5
    })
    return result
  }

  invalidate(): void {
    if (!this.worker) return
    this.worker.postMessage({ type: 'invalidate' })
  }

  add(params: { sourceLang: string; targetLang: string; source: string; target: string }): void {
    if (!this.worker) return
    this.worker.postMessage({ type: 'add', ...params })
  }

  async dispose(): Promise<void> {
    const worker = this.worker
    this.worker = null
    this.ready = null
    for (const [, pending] of this.pending) {
      pending.reject(new Error('similarity worker disposed'))
    }
    this.pending.clear()
    if (!worker) return
    await worker.terminate()
  }

  private register<T>(requestId: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.set(requestId, {
        resolve: (value) => resolve(value as T),
        reject
      })
    })
  }

  private workerOrThrow(): Worker {
    if (!this.worker) throw new Error('similarity worker failed to start')
    return this.worker
  }

  private async ensureReady(): Promise<void> {
    if (this.worker && this.ready) {
      await this.ready
      return
    }

    const worker = new Worker(path.join(__dirname, 'similarity.worker.js'))
    this.worker = worker
    this.ready = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('similarity worker ready timeout')), 15_000)
      const onMessage = (msg: { type?: string }): void => {
        if (msg?.type !== 'ready') return
        clearTimeout(timeout)
        worker.off('message', onMessage)
        resolve()
      }
      worker.on('message', onMessage)
      worker.once('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })
      worker.postMessage({ type: 'configure', dbPath: this.dbPath })
    })

    worker.on(
      'message',
      (msg: { type?: string; requestId?: number; message?: string; hits?: unknown }) => {
        if (msg?.type === 'ready') return
        if (msg?.type === 'error') {
          const pending = msg.requestId != null ? this.pending.get(msg.requestId) : undefined
          const err = new Error(msg.message ?? 'similarity worker error')
          if (pending && msg.requestId != null) {
            this.pending.delete(msg.requestId)
            pending.reject(err)
          }
          return
        }
        if (msg?.requestId == null) return
        const pending = this.pending.get(msg.requestId)
        if (!pending) return
        this.pending.delete(msg.requestId)
        pending.resolve(msg.hits)
      }
    )

    worker.on('error', (err) => {
      for (const [, pending] of this.pending) pending.reject(err)
      this.pending.clear()
      this.worker = null
      this.ready = null
    })

    worker.on('exit', (code) => {
      if (this.worker !== worker) return
      const err = new Error(`similarity worker exited with code ${code}`)
      for (const [, pending] of this.pending) pending.reject(err)
      this.pending.clear()
      this.worker = null
      this.ready = null
    })

    await this.ready
  }
}

let client: SimilarityClient | null = null

export function getSimilarityClient(dbPath: string): SimilarityClient {
  if (!client) client = new SimilarityClient(dbPath)
  return client
}

export function invalidateSimilarityCache(): void {
  client?.invalidate()
}

export async function disposeSimilarityClient(): Promise<void> {
  const current = client
  client = null
  await current?.dispose()
}
