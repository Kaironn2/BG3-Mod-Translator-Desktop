import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  exportFormatsFor,
  getParser,
  PARSER_CATALOG,
  parserAcceptsExtension,
  searchParsers
} from './catalog'
import { guessCsvColumns } from './csv-columns'

test('catalog exposes csv, bg3 and coming-soon games', () => {
  assert.deepEqual(
    PARSER_CATALOG.map((parser) => parser.id),
    ['csv', 'bg3', 'skyrim', 'until-then']
  )
  assert.equal(getParser('skyrim')?.status, 'comingSoon')
  assert.equal(getParser('until-then')?.status, 'comingSoon')
})

test('search is accent-insensitive and matches name or extension', () => {
  assert.equal(searchParsers('baldur')[0]?.id, 'bg3')
  assert.equal(searchParsers('csv')[0]?.id, 'csv')
  assert.equal(searchParsers('until')[0]?.id, 'until-then')
  assert.equal(searchParsers('skyrim')[0]?.id, 'skyrim')
  assert.equal(searchParsers('pak')[0]?.id, 'bg3')
  assert.equal(searchParsers('xyzzy').length, 0)
})

test('export formats keep parser natives then generic csv/json', () => {
  assert.deepEqual(exportFormatsFor(getParser('bg3')!), [
    'xml',
    'loca',
    'pak',
    'zip',
    'csv',
    'json'
  ])
  assert.deepEqual(exportFormatsFor(getParser('csv')!), ['csv', 'json'])
  assert.deepEqual(exportFormatsFor(getParser('until-then')!), ['csv', 'json'])
})

test('parserAcceptsExtension uses the parser allow-list', () => {
  assert.equal(parserAcceptsExtension(getParser('bg3')!, 'mod.pak'), true)
  assert.equal(parserAcceptsExtension(getParser('bg3')!, 'table.csv'), false)
  assert.equal(parserAcceptsExtension(getParser('csv')!, 'table.CSV'), true)
})

test('csv column guess maps messy headers to source/target', () => {
  const guessed = guessCsvColumns(['Portugues do Brasil', 'Ingles', 'uid'])
  assert.equal(guessed.sourceColumn, 'Ingles')
  assert.equal(guessed.targetColumn, 'Portugues do Brasil')
  assert.equal(guessed.uidColumn, 'uid')
})

test('csv target stays optional when only source exists', () => {
  const guessed = guessCsvColumns(['English'])
  assert.equal(guessed.sourceColumn, 'English')
  assert.equal(guessed.targetColumn, null)
  assert.equal(guessed.uidColumn, null)
})
