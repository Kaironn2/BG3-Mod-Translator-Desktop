import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { SimilarityIndex, tokenize } from './similarity.service'

// Golden contract against test-fixtures/similarity: the inverted-index search over a
// locked corpus must reproduce the exact hit order and scores. The Rust port
// (rapidfuzz-style) has to land on the same results; score is an IEEE double
// computed by the same operation order, so compare exactly.

const FIXTURES = join('test-fixtures', 'similarity')

interface Corpus {
  rows: { source: string; target: string }[]
  queries: { uid: string; text: string }[]
}

const corpus = JSON.parse(readFileSync(join(FIXTURES, 'corpus.json'), 'utf-8')) as Corpus
const expected = JSON.parse(
  readFileSync(join(FIXTURES, 'expected-search.json'), 'utf-8')
) as Array<{ uid: string; hits: { original: string; translated: string; score: number }[] }>

const index = new SimilarityIndex(corpus.rows)

for (const locked of expected) {
  const query = corpus.queries.find((q) => q.uid === locked.uid)
  assert.ok(query, `query ${locked.uid} exists in corpus`)
  test(`golden: search ${locked.uid}`, () => {
    const hits = index.search(query.text, 5)
    assert.deepEqual(hits, locked.hits)
  })
}

test('golden: tokenizer folds case, accents and punctuation', () => {
  const expectedTokens = JSON.parse(
    readFileSync(join(FIXTURES, 'expected-tokens.json'), 'utf-8')
  ) as Array<{ source: string; tokens: string[] }>
  for (const locked of expectedTokens) {
    assert.deepEqual(tokenize(locked.source), locked.tokens)
  }
})

test('golden: incremental add keeps matching', () => {
  const grown = new SimilarityIndex(corpus.rows.slice(0, 10))
  for (const row of corpus.rows.slice(10)) grown.add(row)
  const query = corpus.queries.find((q) => q.uid === 'q-typo-word')
  assert.ok(query)
  const hits = grown.search(query.text, 5)
  assert.deepEqual(hits, expected.find((row) => row.uid === 'q-typo-word')?.hits)
})
