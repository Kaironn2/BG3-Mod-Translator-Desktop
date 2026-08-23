/**
 * Real-data benchmark for dictionary similarity + list-query patterns.
 *
 * Usage:
 *   node scripts/bench-similarity.mjs
 *   node scripts/bench-similarity.mjs --phase=baseline
 *   node scripts/bench-similarity.mjs --phase=optimized
 *
 * Reads data/dictionary.csv and data/enhanced-elemental-gear.xml.
 * Does not write to the live app database.
 */
import fs from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath, pathToFileURL } from 'node:url'
import Fuse from 'fuse.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CSV_PATH = path.join(ROOT, 'data', 'dictionary.csv')
const XML_PATH = path.join(ROOT, 'data', 'enhanced-elemental-gear.xml')
const OUT_DIR = path.join(ROOT, 'scripts', 'bench-results')

const FUSE_OPTIONS = {
  keys: ['source'],
  includeScore: true,
  threshold: 0.6
}

const phaseArg = process.argv.find((a) => a.startsWith('--phase='))
const phase = phaseArg ? phaseArg.slice('--phase='.length) : 'both'

function now() {
  return performance.now()
}

function timed(label, fn) {
  const start = now()
  const value = fn()
  const ms = now() - start
  return { label, ms, value }
}

async function timedAsync(label, fn) {
  const start = now()
  const value = await fn()
  const ms = now() - start
  return { label, ms, value }
}

function parseCsvTable(content) {
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  if (!normalized.trim()) return { headers: [], rows: [] }

  const rows = []
  let currentRow = []
  let currentCell = ''
  let inQuotes = false

  for (let index = 0; index < normalized.length; index++) {
    const char = normalized[index]
    const next = normalized[index + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"'
        index++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      currentRow.push(currentCell)
      currentCell = ''
      continue
    }

    if (char === '\n' && !inQuotes) {
      currentRow.push(currentCell)
      rows.push(currentRow)
      currentRow = []
      currentCell = ''
      continue
    }

    currentCell += char
  }

  currentRow.push(currentCell)
  rows.push(currentRow)

  const nonEmptyRows = rows.filter((row) => row.some((cell) => cell.trim() !== ''))
  if (nonEmptyRows.length === 0) return { headers: [], rows: [] }

  return {
    headers: nonEmptyRows[0].map((header) => header.trim()),
    rows: nonEmptyRows.slice(1)
  }
}

function parseXmlEntries(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const entries = []
  const re = /<content\s+contentuid="([^"]+)"\s+version="([^"]+)">([\s\S]*?)<\/content>/g
  let match = re.exec(raw)
  while (match !== null) {
    entries.push({ contentuid: match[1], version: match[2], text: match[3] })
    match = re.exec(raw)
  }
  return entries
}

function percentile(values, p) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx]
}

function summarizeMs(values) {
  if (values.length === 0) return { n: 0 }
  const sum = values.reduce((a, b) => a + b, 0)
  return {
    n: values.length,
    min: Math.min(...values),
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    max: Math.max(...values),
    mean: sum / values.length,
    total: sum
  }
}

function round(n, digits = 2) {
  const f = 10 ** digits
  return Math.round(n * f) / f
}

function roundSummary(summary) {
  if (!summary.n) return summary
  return {
    n: summary.n,
    min: round(summary.min),
    p50: round(summary.p50),
    p95: round(summary.p95),
    max: round(summary.max),
    mean: round(summary.mean),
    total: round(summary.total)
  }
}

function loadCorpus(csvRows, headers) {
  const idx = Object.fromEntries(headers.map((h, i) => [h, i]))
  const pairCounts = new Map()
  for (const row of csvRows) {
    const key = `${row[idx.language1]}|${row[idx.language2]}`
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
  }
  const topPair = [...pairCounts.entries()].sort((a, b) => b[1] - a[1])[0]
  const [l1, l2] = topPair[0].split('|')
  const corpus = []
  for (const row of csvRows) {
    if (row[idx.language1] !== l1 || row[idx.language2] !== l2) continue
    corpus.push({
      source: (row[idx.text_language1] ?? '').trim(),
      target: (row[idx.text_language2] ?? '').trim()
    })
  }
  return {
    pair: { language1: l1, language2: l2, rows: corpus.length },
    pairCounts: Object.fromEntries(
      [...pairCounts.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v])
    ),
    corpus
  }
}

function likeScan(corpus, needle) {
  const n = needle.toLowerCase()
  let hits = 0
  for (const row of corpus) {
    if (row.source.toLowerCase().includes(n) || row.target.toLowerCase().includes(n)) hits++
  }
  return hits
}

function runFuseBaseline(corpus, queries) {
  const memBefore = process.memoryUsage()
  const built = timed('fuse.build', () => new Fuse(corpus, FUSE_OPTIONS))
  const fuse = built.value
  const memAfterBuild = process.memoryUsage()

  const perQuery = []
  const first = timed('fuse.search.first', () => fuse.search(queries[0] ?? 'sword', { limit: 5 }))
  perQuery.push(first.ms)

  for (let i = 1; i < queries.length; i++) {
    const start = now()
    fuse.search(queries[i], { limit: 5 })
    perQuery.push(now() - start)
  }

  return {
    buildMs: round(built.ms),
    search: roundSummary(summarizeMs(perQuery)),
    firstSearchMs: round(first.ms),
    firstHits: first.value.map((r) => ({
      score: r.score,
      source: r.item.source.slice(0, 80)
    })),
    rssAfterBuildMb: round(memAfterBuild.rss / 1024 / 1024),
    heapAfterBuildMb: round(memAfterBuild.heapUsed / 1024 / 1024),
    rssBeforeMb: round(memBefore.rss / 1024 / 1024)
  }
}

async function loadOptimizedIndex(corpus) {
  const serviceUrl = pathToFileURL(path.join(ROOT, 'src', 'main', 'services', 'similarity.service.ts')).href
  const mod = await import(serviceUrl)
  const built = await timedAsync('optimized.build', async () => new mod.SimilarityIndex(corpus))
  return { mod, index: built.value, buildMs: built.ms }
}

async function runOptimized(corpus, queries) {
  const memBefore = process.memoryUsage()
  const { index, buildMs } = await loadOptimizedIndex(corpus)
  const memAfterBuild = process.memoryUsage()

  const perQuery = []
  const first = timed('optimized.search.first', () => index.search(queries[0] ?? 'sword', 5))
  perQuery.push(first.ms)

  for (let i = 1; i < queries.length; i++) {
    const start = now()
    index.search(queries[i], 5)
    perQuery.push(now() - start)
  }

  const batchStart = now()
  const batchHits = queries.map((q) => index.search(q, 3))
  const batchMs = now() - batchStart

  return {
    buildMs: round(buildMs),
    search: roundSummary(summarizeMs(perQuery)),
    firstSearchMs: round(first.ms),
    firstHits: first.value.map((r) => ({
      score: r.score,
      original: r.original.slice(0, 80)
    })),
    batchSearchAllXmlMs: round(batchMs),
    batchHitsNonEmpty: batchHits.filter((h) => h.length > 0).length,
    rssAfterBuildMb: round(memAfterBuild.rss / 1024 / 1024),
    heapAfterBuildMb: round(memAfterBuild.heapUsed / 1024 / 1024),
    rssBeforeMb: round(memBefore.rss / 1024 / 1024)
  }
}

async function main() {
  console.log(`phase=${phase}`)
  const loadCsv = timed('csv.read+parse', () => {
    const content = fs.readFileSync(CSV_PATH, 'utf8')
    return parseCsvTable(content)
  })
  const xmlLoad = timed('xml.parse', () => parseXmlEntries(XML_PATH))
  const corpusLoad = timed('corpus.filterPair', () => loadCorpus(loadCsv.value.rows, loadCsv.value.headers))

  const queries = xmlLoad.value.map((e) => e.text).filter((t) => t.trim().length > 0)
  const report = {
    startedAt: new Date().toISOString(),
    phase,
    files: {
      csvBytes: fs.statSync(CSV_PATH).size,
      xmlBytes: fs.statSync(XML_PATH).size,
      csvRows: loadCsv.value.rows.length,
      xmlEntries: xmlLoad.value.length
    },
    timings: {
      csvParseMs: round(loadCsv.ms),
      xmlParseMs: round(xmlLoad.ms),
      corpusFilterMs: round(corpusLoad.ms)
    },
    pair: corpusLoad.value.pair,
    pairCounts: corpusLoad.value.pairCounts,
    likeScan: null,
    fuse: null,
    optimized: null
  }

  const sampleNeedles = ['sword', 'armor', 'elemental', 'saving throw', queries[0]?.slice(0, 12) || 'the']
  const likeTimings = []
  const likeHits = {}
  for (const needle of sampleNeedles) {
    const t = timed(`like:${needle}`, () => likeScan(corpusLoad.value.corpus, needle))
    likeTimings.push(t.ms)
    likeHits[needle] = t.value
  }
  report.likeScan = {
    hits: likeHits,
    ms: roundSummary(summarizeMs(likeTimings))
  }

  if (phase === 'baseline' || phase === 'both') {
    console.log(`Building Fuse index over ${corpusLoad.value.corpus.length} rows...`)
    report.fuse = runFuseBaseline(corpusLoad.value.corpus, queries)
    console.log('Fuse done', report.fuse.buildMs, 'ms build,', report.fuse.search.mean, 'ms mean search')
  }

  if (phase === 'optimized' || phase === 'both') {
    try {
      console.log(`Building optimized index over ${corpusLoad.value.corpus.length} rows...`)
      report.optimized = await runOptimized(corpusLoad.value.corpus, queries)
      console.log(
        'Optimized done',
        report.optimized.buildMs,
        'ms build,',
        report.optimized.search.mean,
        'ms mean search'
      )
    } catch (err) {
      report.optimized = { error: err instanceof Error ? err.message : String(err) }
      console.error('Optimized phase failed:', report.optimized.error)
    }
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const outPath = path.join(OUT_DIR, `${phase}-${Date.now()}.json`)
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8')
  console.log(JSON.stringify(report, null, 2))
  console.log(`wrote ${outPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
