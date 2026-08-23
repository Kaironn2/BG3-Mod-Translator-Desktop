import type { SimilarityRow } from '../database/repositories/dictionary.repo'

export interface SimilarEntry {
  original: string
  translated: string
  score: number
}

// Distance in [0, 1] (0 = identical), same convention Fuse.js used. The UI and
// filterExamples convert with `1 - score`. Candidates worse than this are dropped.
const MAX_DISTANCE = 0.75
const MAX_CANDIDATES = 250
const MAX_POSTING_FRACTION = 0.5
const TOKEN_RE = /[^\p{L}\p{N}]+/u

export function tokenize(text: string): string[] {
  if (!text) return []
  const parts = text.toLowerCase().normalize('NFKD').split(TOKEN_RE)
  const tokens: string[] = []
  for (const part of parts) {
    if (part.length >= 2) tokens.push(part)
  }
  return tokens
}

function uniqueTokens(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const token of tokenize(text)) {
    if (seen.has(token)) continue
    seen.add(token)
    out.push(token)
  }
  return out
}

function trigrams(text: string): string[] {
  const padded = `  ${text.toLowerCase()} `
  const grams: string[] = []
  for (let i = 0; i <= padded.length - 3; i++) grams.push(padded.slice(i, i + 3))
  return grams
}

function dice(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1
  if (a.length === 0 || b.length === 0) return 0
  const other = new Set(b)
  let overlap = 0
  for (const item of a) {
    if (other.has(item)) overlap++
  }
  return (2 * overlap) / (a.length + b.length)
}

function lengthRatio(a: number, b: number): number {
  const max = Math.max(a, b, 1)
  const min = Math.min(a, b)
  return min / max
}

export class SimilarityIndex {
  private rows: SimilarityRow[]
  private tokensByRow: string[][] = []
  private postings = new Map<string, number[]>()
  private count = 0

  constructor(corpus: SimilarityRow[]) {
    this.rows = corpus
    this.tokensByRow = new Array(corpus.length)
    for (let i = 0; i < corpus.length; i++) this.indexRow(i)
    this.count = corpus.length
  }

  add(entry: SimilarityRow): void {
    this.rows.push(entry)
    this.indexRow(this.count)
    this.count++
  }

  get size(): number {
    return this.count
  }

  search(text: string, limit = 5): SimilarEntry[] {
    if (this.count === 0 || limit <= 0) return []
    const query = text.trim()
    if (!query) return []

    const queryNorm = query.toLowerCase()
    const queryTokens = uniqueTokens(query)
    const candidates = this.collectCandidates(queryTokens)
    if (candidates.size === 0) {
      const exact = this.findExact(queryNorm)
      return exact ? [exact] : []
    }

    const queryGrams = query.length <= 120 ? trigrams(query) : null
    const queryTokenSet = new Set(queryTokens)
    const scored: SimilarEntry[] = []

    for (const row of candidates) {
      const source = this.rows[row]?.source
      if (!source) continue
      const distance = this.scoreRow(queryNorm, queryTokenSet, queryGrams, row)
      if (distance > MAX_DISTANCE) continue
      scored.push({
        original: source,
        translated: this.rows[row].target,
        score: distance
      })
    }

    scored.sort((a, b) => a.score - b.score || a.original.length - b.original.length)
    if (scored.length > limit) scored.length = limit
    return scored
  }

  searchMany(queries: { uid: string; text: string }[], limit = 5): Map<string, SimilarEntry[]> {
    const out = new Map<string, SimilarEntry[]>()
    for (const query of queries) {
      out.set(query.uid, this.search(query.text, limit))
    }
    return out
  }

  private indexRow(index: number): void {
    const tokens = uniqueTokens(this.rows[index].source)
    this.tokensByRow[index] = tokens
    for (const token of tokens) {
      const list = this.postings.get(token)
      if (list) list.push(index)
      else this.postings.set(token, [index])
    }
  }

  private collectCandidates(queryTokens: string[]): Set<number> {
    if (queryTokens.length === 0) return new Set()

    const ranked = queryTokens
      .map((token) => {
        const list = this.postings.get(token)
        return { token, list, df: list?.length ?? 0 }
      })
      .filter((item) => item.df > 0)
      .sort((a, b) => a.df - b.df)

    if (ranked.length === 0) return new Set()

    const weights = new Map<number, number>()
    let used = 0
    for (const item of ranked) {
      if (!item.list) continue
      const tooCommon = item.df > this.count * MAX_POSTING_FRACTION
      if (tooCommon && used >= 2) continue
      const idf = Math.log(1 + this.count / (item.df + 1))
      for (const row of item.list) {
        weights.set(row, (weights.get(row) ?? 0) + idf)
      }
      used++
      if (weights.size >= 4000 && used >= 2) break
    }

    if (weights.size === 0) {
      for (const item of ranked) {
        if (!item.list) continue
        for (const row of item.list) weights.set(row, (weights.get(row) ?? 0) + 1)
        if (weights.size >= 4000) break
      }
    }

    if (weights.size <= MAX_CANDIDATES) return new Set(weights.keys())

    return new Set(
      [...weights.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_CANDIDATES)
        .map(([row]) => row)
    )
  }

  private scoreRow(
    queryNorm: string,
    queryTokens: Set<string>,
    queryGrams: string[] | null,
    row: number
  ): number {
    const source = this.rows[row].source
    const sourceNorm = source.toLowerCase()
    if (sourceNorm === queryNorm) return 0

    const rowTokens = this.tokensByRow[row]
    const rowTokenSet = new Set(rowTokens)
    let overlap = 0
    let queryWeight = 0
    let overlapWeight = 0
    for (const token of queryTokens) {
      const df = this.postings.get(token)?.length ?? this.count
      const idf = Math.log(1 + this.count / (df + 1))
      queryWeight += idf
      if (!rowTokenSet.has(token)) continue
      overlap++
      overlapWeight += idf
    }

    const querySize = queryTokens.size
    const rowSize = rowTokens.length
    const union = querySize + rowSize - overlap
    const rowCoverage = rowSize === 0 ? 0 : overlap / rowSize
    const weightedCoverage = queryWeight === 0 ? 0 : overlapWeight / queryWeight
    const coverage = Math.max(weightedCoverage, rowCoverage)
    const jaccard = union === 0 ? 1 : overlap / union
    const ratio = lengthRatio(queryNorm.length, sourceNorm.length)

    if (querySize >= 4 && weightedCoverage < 0.22 && rowCoverage < 0.7) return 1

    let similarity = 0.55 * weightedCoverage + 0.2 * rowCoverage + 0.15 * jaccard + 0.1 * ratio
    if (queryGrams && queryNorm.length <= 120 && sourceNorm.length <= 180) {
      similarity = 0.75 * similarity + 0.25 * dice(queryGrams, trigrams(source))
    }

    if (ratio < 0.22 && coverage < 0.85) similarity *= 0.5
    return Math.min(1, Math.max(0, 1 - similarity))
  }

  private findExact(queryNorm: string): SimilarEntry | null {
    for (let i = 0; i < this.count; i++) {
      if (this.rows[i].source.toLowerCase() === queryNorm) {
        return { original: this.rows[i].source, translated: this.rows[i].target, score: 0 }
      }
    }
    return null
  }
}

export function findSimilar(
  sourceText: string,
  corpus: SimilarityRow[],
  limit = 5
): SimilarEntry[] {
  if (corpus.length === 0) return []
  return new SimilarityIndex(corpus).search(sourceText, limit)
}
