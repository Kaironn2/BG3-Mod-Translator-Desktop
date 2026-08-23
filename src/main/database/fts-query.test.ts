import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toFtsQuery } from './fts-query'

test('empty or tiny input is not searchable', () => {
  assert.equal(toFtsQuery(''), null)
  assert.equal(toFtsQuery('  a  '), null)
  assert.equal(toFtsQuery('!!'), null)
})

test('builds prefix AND query from words', () => {
  assert.equal(toFtsQuery('Elemental Armor'), 'elemental* AND armor*')
})

test('strips punctuation and reserved FTS words', () => {
  assert.equal(toFtsQuery('hello, AND world!'), 'hello* AND world*')
})
