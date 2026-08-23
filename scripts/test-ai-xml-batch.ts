// Live smoke: dictionary similarity + OpenAI grouped translation of
// data/enhanced-elemental-gear.xml, the same path the AI batch uses.
//
// Usage: node --env-file=.env --experimental-strip-types scripts/test-ai-xml-batch.ts

import fs from 'node:fs'
import path from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import { aiTranslateGroup } from '../src/main/services/ai/ai-translate.service'
import { estimateTokens, GROUP_LIMITS, packEntriesIntoGroups } from '../src/main/services/ai/batch-grouping'
import { DEFAULT_PROMPT, filterExamples } from '../src/main/services/ai/prompt-builder'
import { SimilarityIndex } from '../src/main/services/similarity.service'
import { parseCsvTable } from '../src/main/utils/csv'
import { dictionaryTextKey } from '../src/main/utils/dictionaryText'
import { parseLocalizationXml } from '../src/main/services/xml-parser.service'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CSV_PATH = path.join(ROOT, 'data', 'dictionary.csv')
const XML_PATH = path.join(ROOT, 'data', 'enhanced-elemental-gear.xml')
const OUT_PATH = path.join(ROOT, 'scripts', 'bench-results', 'ai-xml-batch.json')

const SOURCE_LANG = 'English'
const TARGET_LANG = 'Brazilian Portuguese'
const MODEL = 'gpt-4o-mini'
const SIM_COUNT = 3
const SIM_MIN_SCORE = 0.35

function round(n: number, digits = 2): number {
  const f = 10 ** digits
  return Math.round(n * f) / f
}

function timed<T>(fn: () => T): { ms: number; value: T } {
  const start = performance.now()
  const value = fn()
  return { ms: performance.now() - start, value }
}

async function timedAsync<T>(fn: () => Promise<T>): Promise<{ ms: number; value: T }> {
  const start = performance.now()
  const value = await fn()
  return { ms: performance.now() - start, value }
}

function loadCorpus(csvPath: string): { source: string; target: string }[] {
  const table = parseCsvTable(fs.readFileSync(csvPath, 'utf8'))
  const idx = Object.fromEntries(table.headers.map((h, i) => [h, i]))
  const corpus: { source: string; target: string }[] = []
  for (const row of table.rows) {
    if (row[idx.language1] !== 'en' || row[idx.language2] !== 'pt-BR') continue
    corpus.push({
      source: (row[idx.text_language1] ?? '').trim(),
      target: (row[idx.text_language2] ?? '').trim()
    })
  }
  return corpus
}

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    console.error('OPENAI_API_KEY is not set. Run with --env-file=.env')
    process.exit(1)
  }

  console.log(`key=present length=${apiKey.length} model=${MODEL}`)
  console.log(`xml=${XML_PATH}`)
  console.log(`csv=${CSV_PATH}`)

  const xmlLoad = timed(() => parseLocalizationXml(XML_PATH))
  const csvLoad = timed(() => loadCorpus(CSV_PATH))
  const entries = xmlLoad.value.map((entry) => ({
    uid: entry.contentuid,
    source: entry.text
  }))

  const exactMap = new Map<string, string>()
  for (const row of csvLoad.value) {
    const key = dictionaryTextKey(row.source)
    if (key && !exactMap.has(key)) exactMap.set(key, row.target)
  }

  const hits: { uid: string; source: string; target: string; from: 'dictionary' | 'ai' }[] = []
  const pending = []
  for (const entry of entries) {
    const cached = exactMap.get(dictionaryTextKey(entry.source))
    if (cached) hits.push({ ...entry, target: cached, from: 'dictionary' })
    else pending.push(entry)
  }

  console.log(
    `xmlEntries=${entries.length} csvRows=${csvLoad.value.length} exactHits=${hits.length} aiPending=${pending.length}`
  )
  console.log(`csvParseMs=${round(csvLoad.ms)} xmlParseMs=${round(xmlLoad.ms)}`)

  const indexBuild = timed(() => new SimilarityIndex(csvLoad.value))
  const index = indexBuild.value
  console.log(`similarityBuildMs=${round(indexBuild.ms)} indexSize=${index.size}`)

  const examplesByUid = new Map<string, ReturnType<typeof filterExamples>>()
  const search = timed(() => {
    for (const entry of pending) {
      examplesByUid.set(
        entry.uid,
        filterExamples(index.search(entry.source, SIM_COUNT), {
          count: SIM_COUNT,
          minScore: SIM_MIN_SCORE
        })
      )
    }
  })
  const withExamples = pending.filter((entry) => (examplesByUid.get(entry.uid) ?? []).length > 0)
  console.log(
    `similaritySearchMs=${round(search.ms)} pendingWithExamples=${withExamples.length}/${pending.length}`
  )

  const templateOverhead = estimateTokens(DEFAULT_PROMPT) + 200
  const groups = packEntriesIntoGroups(pending, examplesByUid, templateOverhead, GROUP_LIMITS)
  console.log(`groups=${groups.length} maxLines=${GROUP_LIMITS.maxLines}`)

  let groupIndex = 0
  const groupTimings: number[] = []
  let translated = 0
  let missed = 0
  const sample: { source: string; target: string; examples: number }[] = []

  for (const group of groups) {
    groupIndex++
    const run = await timedAsync(() =>
      aiTranslateGroup({
        providerId: 'openai',
        apiKey,
        model: MODEL,
        template: DEFAULT_PROMPT,
        entries: group.entries,
        sourceLangName: SOURCE_LANG,
        targetLangName: TARGET_LANG,
        examples: group.examples
      })
    )
    groupTimings.push(run.ms)
    translated += run.value.translations.size
    missed += run.value.missedUids.length

    for (const entry of group.entries) {
      const target = run.value.translations.get(entry.uid)
      if (target) {
        hits.push({ ...entry, target, from: 'ai' })
        if (sample.length < 5) {
          sample.push({
            source: entry.source.slice(0, 120),
            target: target.slice(0, 160),
            examples: (examplesByUid.get(entry.uid) ?? []).length
          })
        }
      }
    }

    console.log(
      `group ${groupIndex}/${groups.length} lines=${group.entries.length} examples=${group.examples.length} ms=${round(run.ms)} translated=${run.value.translations.size} missed=${run.value.missedUids.length}`
    )
  }

  const report = {
    startedAt: new Date().toISOString(),
    model: MODEL,
    xmlEntries: entries.length,
    dictionaryRows: csvLoad.value.length,
    exactHits: hits.filter((h) => h.from === 'dictionary').length,
    aiPending: pending.length,
    aiTranslated: translated,
    aiMissed: missed,
    groups: groups.length,
    timings: {
      csvParseMs: round(csvLoad.ms),
      xmlParseMs: round(xmlLoad.ms),
      similarityBuildMs: round(indexBuild.ms),
      similaritySearchMs: round(search.ms),
      groupMs: groupTimings.map((ms) => round(ms)),
      groupTotalMs: round(groupTimings.reduce((a, b) => a + b, 0)),
      similarityVsApi: {
        similarityMs: round(indexBuild.ms + search.ms),
        apiMs: round(groupTimings.reduce((a, b) => a + b, 0))
      }
    },
    sample
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2), 'utf8')
  console.log(JSON.stringify(report, null, 2))
  console.log(`wrote ${OUT_PATH}`)
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  console.error(message)
  process.exit(1)
})
