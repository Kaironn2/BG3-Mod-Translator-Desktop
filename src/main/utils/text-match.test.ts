import assert from 'node:assert/strict'
import { test } from 'node:test'
import { applyTextReplace, getTextMatcher, textMatches } from './text-match'

test('substring search is case-insensitive by default', () => {
  assert.equal(textMatches('espada', 'Espada Elemental'), true)
  assert.equal(textMatches('ESPADA', 'Espada Elemental'), true)
  assert.equal(textMatches('escudo', 'Espada Elemental'), false)
})

test('match case uses exact casing', () => {
  assert.equal(textMatches('Espada', 'Espada Elemental', { matchCase: true }), true)
  assert.equal(textMatches('espada', 'Espada Elemental', { matchCase: true }), false)
})

test('whole-word uses unicode letters as word chars', () => {
  assert.equal(textMatches('nação', 'A nação é antiga', { wholeWord: true }), true)
  assert.equal(textMatches('na', 'A nação é antiga', { wholeWord: true }), false)
  assert.equal(textMatches('sword', 'longsword', { wholeWord: true }), false)
  assert.equal(textMatches('sword', 'Elemental Sword', { wholeWord: true }), true)
})

test('replace uses the same matcher as search', () => {
  assert.equal(
    applyTextReplace('A nação é antiga', { find: 'na', replaceWith: 'X', matchWholeWord: true }),
    'A nação é antiga'
  )
  assert.equal(
    applyTextReplace('Elemental Sword', {
      find: 'Sword',
      replaceWith: 'Blade',
      matchWholeWord: true
    }),
    'Elemental Blade'
  )
  assert.equal(
    applyTextReplace('Espada Elemental', { find: 'espada', replaceWith: 'Lâmina' }),
    'Lâmina Elemental'
  )
  assert.equal(
    applyTextReplace('Espada Elemental', {
      find: 'espada',
      replaceWith: 'Lâmina',
      matchCase: true
    }),
    'Espada Elemental'
  )
})

test('replace does not rewrite xml tags or placeholders', () => {
  assert.equal(
    applyTextReplace('See <div>foo</div> foo', { find: 'div', replaceWith: 'span' }),
    'See <div>foo</div> foo'
  )
  assert.equal(
    applyTextReplace('Use {Name} Name', {
      find: 'Name',
      replaceWith: 'Nome',
      matchWholeWord: true
    }),
    'Use {Name} Nome'
  )
})

test('getTextMatcher returns null for blank queries', () => {
  assert.equal(getTextMatcher('   '), null)
})
