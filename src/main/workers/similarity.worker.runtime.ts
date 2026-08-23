import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { DictionaryRepository } from '../database/repositories/dictionary.repo'
import * as schema from '../database/schema'
import { applySqlitePragmas } from '../database/sqlite-pragmas'
import { type SimilarEntry, SimilarityIndex } from '../services/similarity.service'
import { normalizeLangs } from '../utils/languages'

export type SimilarityWorkerRequest =
  | { type: 'configure'; dbPath: string }
  | {
      type: 'search'
      requestId: number
      sourceLang: string
      targetLang: string
      text: string
      limit: number
    }
  | {
      type: 'searchMany'
      requestId: number
      sourceLang: string
      targetLang: string
      queries: { uid: string; text: string }[]
      limit: number
    }
  | { type: 'add'; sourceLang: string; targetLang: string; source: string; target: string }
  | { type: 'invalidate' }

export type SimilarityWorkerResponse =
  | { type: 'ready' }
  | { type: 'result'; requestId: number; hits: SimilarEntry[] }
  | { type: 'resultMany'; requestId: number; hits: Record<string, SimilarEntry[]> }
  | { type: 'error'; requestId?: number; message: string }

export function createSimilarityWorkerRuntime(
  post: (msg: SimilarityWorkerResponse) => void
): (msg: SimilarityWorkerRequest) => void {
  let dbPath = ''
  let sqlite: Database.Database | null = null
  const indexes = new Map<string, SimilarityIndex>()

  function pairKey(sourceLang: string, targetLang: string): string {
    const [l1, l2] = normalizeLangs(sourceLang, targetLang)
    return `${l1}|${l2}`
  }

  function openDb(): Database.Database {
    if (sqlite) return sqlite
    if (!dbPath) throw new Error('similarity worker is not configured')
    sqlite = new Database(dbPath, { readonly: true, fileMustExist: true })
    applySqlitePragmas(sqlite)
    return sqlite
  }

  function closeDb(): void {
    sqlite?.close()
    sqlite = null
  }

  function loadIndex(sourceLang: string, targetLang: string): SimilarityIndex {
    const key = pairKey(sourceLang, targetLang)
    const cached = indexes.get(key)
    if (cached) return cached

    const db = drizzle(openDb(), { schema })
    const repo = new DictionaryRepository(db)
    const corpus = repo.getAllForSimilarity(sourceLang, targetLang)
    const index = new SimilarityIndex(corpus)
    indexes.set(key, index)
    return index
  }

  return (msg: SimilarityWorkerRequest): void => {
    try {
      switch (msg.type) {
        case 'configure':
          dbPath = msg.dbPath
          indexes.clear()
          closeDb()
          post({ type: 'ready' })
          return
        case 'invalidate':
          indexes.clear()
          closeDb()
          return
        case 'add': {
          const key = pairKey(msg.sourceLang, msg.targetLang)
          indexes.get(key)?.add({ source: msg.source, target: msg.target })
          return
        }
        case 'search': {
          const hits = loadIndex(msg.sourceLang, msg.targetLang).search(msg.text, msg.limit)
          post({ type: 'result', requestId: msg.requestId, hits })
          return
        }
        case 'searchMany': {
          const index = loadIndex(msg.sourceLang, msg.targetLang)
          const hits: Record<string, SimilarEntry[]> = {}
          for (const query of msg.queries) {
            hits[query.uid] = index.search(query.text, msg.limit)
          }
          post({ type: 'resultMany', requestId: msg.requestId, hits })
          return
        }
      }
    } catch (err) {
      post({
        type: 'error',
        requestId: 'requestId' in msg ? msg.requestId : undefined,
        message: err instanceof Error ? err.message : String(err)
      })
    }
  }
}
