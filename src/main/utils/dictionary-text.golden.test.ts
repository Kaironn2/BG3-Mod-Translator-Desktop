import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { decodeEntities } from '../services/xml-entities.service'
import { dictionaryTextKey, normalizeDictionaryText } from './dictionaryText'

// Golden contract against test-fixtures/dictionary-text: entity decoding, NBSP/space
// trimming and key lowercasing are the normalization surface the Rust side must match
// before any merge/compare decision.

const FIXTURES = join('test-fixtures', 'dictionary-text')

interface Locked {
  name: string
  normalized: string
  key: string
  decoded: string
}

const locked = JSON.parse(readFileSync(join(FIXTURES, 'expected.json'), 'utf-8')) as Locked[]
const cases = JSON.parse(readFileSync(join(FIXTURES, 'cases.json'), 'utf-8')) as {
  cases: { name: string; input: string }[]
}

for (const row of locked) {
  const input = cases.cases.find((entry) => entry.name === row.name)?.input
  assert.ok(input !== undefined, `case ${row.name} exists`)
  test(`golden: text ${row.name}`, () => {
    assert.equal(normalizeDictionaryText(input), row.normalized)
    assert.equal(dictionaryTextKey(input), row.key)
    assert.equal(decodeEntities(input), row.decoded)
  })
}
