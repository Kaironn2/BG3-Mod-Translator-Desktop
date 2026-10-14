import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { estimateTokens, packEntriesIntoGroups } from '../../src/main/services/ai/batch-grouping'
import { buildLinesBlock, parseGroupResponse } from '../../src/main/services/ai/group-format'
import {
  DEFAULT_PROMPT,
  filterExamples,
  renderPrompt
} from '../../src/main/services/ai/prompt-builder'
import { SimilarityIndex, tokenize } from '../../src/main/services/similarity.service'
import { decodeEntities } from '../../src/main/services/xml-entities.service'
import {
  parseLocalizationXml,
  writeLocalizationXml
} from '../../src/main/services/xml-parser.service'
import { readImportCsv } from '../../src/main/utils/dictionaryCsv'
import { dictionaryTextKey, normalizeDictionaryText } from '../../src/main/utils/dictionaryText'

const FIXTURES = 'test-fixtures'
const BOM = '\uFEFF'

function writeJsonRel(rel: string, value: unknown): void {
  writeJsonEnsureDir(rel, value)
}

function writeJsonEnsureDir(rel: string, value: unknown): void {
  const full = join(FIXTURES, rel)
  mkdirSync(full.slice(0, Math.max(full.lastIndexOf('\\'), full.lastIndexOf('/'))), {
    recursive: true
  })
  writeFileSync(full, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
  console.log(`wrote ${rel}`)
}

interface Corpus {
  baseOverheadTokens: number
  entries: { uid: string; source: string }[]
  examplesByUid: Record<string, { src: string; tgt: string }[]>
}

interface ResponseCase {
  name: string
  expectedCount: number
  raw: string
  empty?: boolean
}

const csvNames = ['canonical.csv', 'aliases.csv', 'unknown-columns.csv']
// BOM variant exercises the byte-order-mark strip in parseCsvTable.
copyFileSync(
  join(FIXTURES, 'dictionary-csv', 'canonical.csv'),
  join(FIXTURES, 'dictionary-csv', 'bom-quoted.csv')
)
writeFileSync(
  join(FIXTURES, 'dictionary-csv', 'bom-quoted.csv'),
  BOM + readFileSync(join(FIXTURES, 'dictionary-csv', 'canonical.csv'), 'utf-8')
)

for (const name of csvNames) {
  readImportCsv(join(FIXTURES, 'dictionary-csv', name))
}
for (const name of csvNames) {
  const { headers, rows } = readImportCsv(join(FIXTURES, 'dictionary-csv', name))
  writeJsonRel(`dictionary-csv/expected/${name}.json`, { headers, rows })
}
const { headers: bomHeaders, rows: bomRows } = readImportCsv(
  join(FIXTURES, 'dictionary-csv', 'bom-quoted.csv')
)
writeJsonRel('dictionary-csv/expected/bom-quoted.csv.json', { headers: bomHeaders, rows: bomRows })

const corpus = JSON.parse(
  readFileSync(join(FIXTURES, 'batch-grouping', 'corpus.json'), 'utf-8')
) as Corpus
const examplesMap = new Map<string, { src: string; tgt: string }[]>(
  Object.entries(corpus.examplesByUid)
)
const groups = packEntriesIntoGroups(corpus.entries, examplesMap, corpus.baseOverheadTokens)
writeJsonRel(
  'batch-grouping/expected-groups.json',
  groups.map((group) => ({
    entries: group.entries.map((entry) => entry.uid),
    sources: group.entries.map((entry) => entry.source),
    tokenEstimates: group.entries.map((entry) => estimateTokens(entry.source)),
    examples: group.examples
  }))
)

const responses = JSON.parse(
  readFileSync(join(FIXTURES, 'group-format', 'responses.json'), 'utf-8')
) as {
  linesBlock: { sources: string[] }
  parseResponses: ResponseCase[]
}
writeJsonRel('group-format/expected-lines-block.json', {
  sources: responses.linesBlock.sources,
  block: buildLinesBlock(responses.linesBlock.sources)
})
writeJsonRel(
  'group-format/expected-parse.json',
  responses.parseResponses.map((response) => ({
    name: response.name,
    parsed: Object.fromEntries(parseGroupResponse(response.raw, response.expectedCount))
  }))
)

const cases = JSON.parse(readFileSync(join(FIXTURES, 'prompt-builder', 'cases.json'), 'utf-8')) as {
  renderPrompt: {
    template: string
    sourceText: string
    targetText: string
    sourceLangName: string
    targetLangName: string
  }
  filterExamples: {
    count: number
    minScore: number
    entries: { original: string; translated: string; score: number }[]
  }
}
writeJsonRel('prompt-builder/expected-render-prompt.json', {
  prompt: renderPrompt({
    ...cases.renderPrompt,
    examples: filterExamples(cases.filterExamples.entries, {
      count: cases.filterExamples.count,
      minScore: cases.filterExamples.minScore
    })
  })
})
writeJsonRel('prompt-builder/expected-default-prompt.json', {
  prompt: renderPrompt({
    template: DEFAULT_PROMPT,
    sourceText: 'Saving Throw',
    targetText: '',
    sourceLangName: 'English',
    targetLangName: 'Brazilian Portuguese'
  })
})

// --- similarity -------------------------------------------------------------

interface SimilarityCorpus {
  rows: { source: string; target: string }[]
  queries: { uid: string; text: string }[]
}

const similarity = JSON.parse(
  readFileSync(join(FIXTURES, 'similarity', 'corpus.json'), 'utf-8')
) as SimilarityCorpus
const index = new SimilarityIndex(similarity.rows)
writeJsonRel(
  'similarity/expected-search.json',
  similarity.queries.map((query) => ({
    uid: query.uid,
    hits: index.search(query.text, 5).map((hit) => ({
      original: hit.original,
      translated: hit.translated,
      score: hit.score
    }))
  }))
)
writeJsonRel(
  'similarity/expected-tokens.json',
  similarity.rows.slice(0, 6).map((row) => ({
    source: row.source,
    tokens: tokenize(row.source)
  }))
)

// --- dictionary text --------------------------------------------------------

interface TextCases {
  cases: { name: string; input: string }[]
}

const textCases = JSON.parse(
  readFileSync(join(FIXTURES, 'dictionary-text', 'cases.json'), 'utf-8')
) as TextCases
writeJsonRel(
  'dictionary-text/expected.json',
  textCases.cases.map((caseRow) => ({
    name: caseRow.name,
    normalized: normalizeDictionaryText(caseRow.input),
    key: dictionaryTextKey(caseRow.input),
    decoded: decodeEntities(caseRow.input)
  }))
)

// --- localization XML -------------------------------------------------------

const xmlPath = join(FIXTURES, 'loca-xml', 'sample-ls.xml')
const xmlEntries = parseLocalizationXml(xmlPath)
writeJsonRel('loca-xml/expected-parse.json', xmlEntries)
const roundTripDir = mkdtempSync(join(tmpdir(), 'icosa-golden-xml-'))
const roundTripPath = join(roundTripDir, 'round-trip.xml')
writeLocalizationXml(xmlEntries, roundTripPath)
const reparsed = parseLocalizationXml(roundTripPath)
rmSync(roundTripDir, { recursive: true, force: true })
writeJsonRel('loca-xml/expected-round-trip.json', {
  stable: reparsed.every((entry, i) => {
    const original = xmlEntries[i]
    return (
      original.contentuid === entry.contentuid &&
      original.version === entry.version &&
      original.text === entry.text
    )
  }),
  reparsed
})
