import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { readImportCsv, readImportCsvPreview } from './dictionaryCsv'

// Golden contract against test-fixtures/dictionary-csv: parsed header/row output for
// the locked CSV dialect is the Drizzle-free half of the dictionary import surface
// (its future Rust counterpart must reproduce these exact rows byte-for-byte).

const FIXTURES = join('test-fixtures', 'dictionary-csv')

function expectedOf(csvName: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, 'expected', `${csvName}.json`), 'utf-8'))
}

for (const csvName of ['canonical.csv', 'aliases.csv', 'unknown-columns.csv', 'bom-quoted.csv']) {
  test(`golden: ${csvName} parses to locked rows`, () => {
    const { headers, rows } = readImportCsv(join(FIXTURES, csvName))
    assert.deepEqual({ headers, rows }, expectedOf(csvName))
  })
}

test('golden: preview slices locks the capped sample shape', () => {
  const { headers, rows, totalRows } = readImportCsvPreview(join(FIXTURES, 'canonical.csv'), 2)
  assert.equal(headers.length, 6)
  assert.equal(totalRows, 5)
  assert.equal(rows.length, 2)
})
