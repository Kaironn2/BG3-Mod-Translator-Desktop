import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { parseLocalizationXml, writeLocalizationXml } from './xml-parser.service'

// Golden contract against test-fixtures/loca-xml: the regex-based LocaXML reader
// preserves mixed content (LSTag inside text), entities stay escaped in the stored
// text and the XML writer round-trips byte-comparable entries back.

const FIXTURES = join('test-fixtures', 'loca-xml')

test('golden: parse locks every entry field in order', () => {
  const expected = JSON.parse(readFileSync(join(FIXTURES, 'expected-parse.json'), 'utf-8'))
  const entries = parseLocalizationXml(join(FIXTURES, 'sample-ls.xml'))
  assert.deepEqual(entries, expected)
})

test('golden: writer round-trips entries', () => {
  const locked = JSON.parse(readFileSync(join(FIXTURES, 'expected-round-trip.json'), 'utf-8')) as {
    stable: boolean
    reparsed: unknown
  }
  const entries = parseLocalizationXml(join(FIXTURES, 'sample-ls.xml'))
  const roundTripDir = mkdtempSync(join(tmpdir(), 'icosa-golden-xml-'))
  const roundTripPath = join(roundTripDir, 'round-trip.xml')
  try {
    writeLocalizationXml(entries, roundTripPath)
    const reparsed = parseLocalizationXml(roundTripPath)
    assert.deepEqual(reparsed, entries)
    assert.equal(locked.stable, true)
    assert.deepEqual(reparsed, locked.reparsed)
  } finally {
    rmSync(roundTripDir, { recursive: true, force: true })
  }
})

test('golden: parser locks the regular-expression shape', () => {
  const entries = parseLocalizationXml(join(FIXTURES, 'sample-ls.xml'))
  // Self-closing <content uid="..." ver/> tags are skipped outright (the reader's
  // regex requires a text body); empty uids never surface as empty rows.
  assert.ok(!entries.some((entry) => entry.contentuid === 'h00000005_v1'))
  assert.equal(entries.length, 5)
  assert.equal(entries[4]?.text, '&amp;amp; literal first amp')
})
