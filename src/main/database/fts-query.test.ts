import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isFtsTokenizable, toFtsQuery } from './fts-query'

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

test('whole-word mode builds a phrase without the prefix wildcard', () => {
  assert.equal(toFtsQuery('Elemental Armor', { wholeWord: true }), '"elemental armor"')
  assert.equal(toFtsQuery('sword', { wholeWord: true }), '"sword"')
})

test('isFtsTokenizable only accepts plain letter/digit words', () => {
  assert.equal(isFtsTokenizable('Elemental Armor'), true)
  assert.equal(isFtsTokenizable('don t'), true)
  assert.equal(isFtsTokenizable("don't"), false)
  assert.equal(isFtsTokenizable('100%'), false)
  assert.equal(isFtsTokenizable('[Sword]'), false)
  assert.equal(isFtsTokenizable('  Sword  '), true)
})
