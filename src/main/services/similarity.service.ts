import Fuse from 'fuse.js'
import type { SimilarityRow } from '../database/repositories/dictionary.repo'

export interface SimilarEntry {
  original: string
  translated: string
  score: number
}

export function findSimilar(
  sourceText: string,
  corpus: SimilarityRow[],
  limit = 5
): SimilarEntry[] {
  if (corpus.length === 0) return []

  const fuse = new Fuse(corpus, {
    keys: ['source'],
    includeScore: true,
    threshold: 0.6
  })

  return fuse.search(sourceText, { limit }).map((r) => ({
    original: r.item.source,
    translated: r.item.target,
    score: r.score ?? 1
  }))
}
