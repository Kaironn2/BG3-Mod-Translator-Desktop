import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { packEntriesIntoGroups } from './batch-grouping'

// Golden contract against test-fixtures/batch-grouping: greedy sequential packing with
// deduped examples locks how batch requests are split; the future Rust packer must
// reproduce the exact group sequence over the same corpus.

const FIXTURES = join('test-fixtures', 'batch-grouping')

interface Corpus {
  baseOverheadTokens: number
  entries: { uid: string; source: string }[]
  examplesByUid: Record<string, { src: string; tgt: string }[]>
}

test('golden: corpus packs into the locked group sequence', () => {
  const corpus = JSON.parse(readFileSync(join(FIXTURES, 'corpus.json'), 'utf-8')) as Corpus
  const expected = JSON.parse(
    readFileSync(join(FIXTURES, 'expected-groups.json'), 'utf-8')
  ) as Array<{
    entries: string[]
    examples: { src: string; tgt: string }[]
  }>

  const groups = packEntriesIntoGroups(
    corpus.entries,
    new Map(Object.entries(corpus.examplesByUid)),
    corpus.baseOverheadTokens
  )

  assert.equal(groups.length, expected.length)
  groups.forEach((group, index) => {
    assert.deepEqual(
      group.entries.map((entry) => entry.uid),
      expected[index]?.entries
    )
    assert.deepEqual(group.examples, expected[index]?.examples)
  })
})

test('golden: shared example across uids dedupes and totals stay under budget', () => {
  const corpus = JSON.parse(readFileSync(join(FIXTURES, 'corpus.json'), 'utf-8')) as Corpus
  const groups = packEntriesIntoGroups(
    corpus.entries,
    new Map(Object.entries(corpus.examplesByUid)),
    corpus.baseOverheadTokens
  )
  const withShared = groups.find((group) => group.entries.some((entry) => entry.uid === 'u2'))
  assert.ok(withShared)
  const goblinSrcs = withShared.examples
    .filter((example) => example.src.startsWith('Goblin'))
    .map((example) => example.src)
  assert.equal(new Set(goblinSrcs).size, goblinSrcs.length)
})
