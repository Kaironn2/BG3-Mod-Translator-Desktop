import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findSimilar, SimilarityIndex, tokenize } from './similarity.service'

test('tokenize splits on punctuation and drops 1-char tokens', () => {
  assert.deepEqual(tokenize('Hello, WORLD! a of swords'), ['hello', 'world', 'of', 'swords'])
})

test('empty corpus returns no hits', () => {
  assert.deepEqual(findSimilar('sword', [], 5), [])
  assert.deepEqual(new SimilarityIndex([]).search('sword'), [])
})

test('exact match scores 0 and ranks first', () => {
  const index = new SimilarityIndex([
    { source: 'Fireball', target: 'Bola de Fogo' },
    { source: 'Ice Knife', target: 'Faca de Gelo' }
  ])
  const hits = index.search('Fireball', 5)
  assert.equal(hits[0]?.original, 'Fireball')
  assert.equal(hits[0]?.translated, 'Bola de Fogo')
  assert.equal(hits[0]?.score, 0)
})

test('similar sentences rank above unrelated ones', () => {
  const index = new SimilarityIndex([
    { source: 'The paladin strikes the goblin', target: 'O paladino ataca o goblin' },
    { source: 'Open the inventory', target: 'Abra o inventario' },
    {
      source: 'The paladin strikes a nearby goblin hard',
      target: 'O paladino golpeia um goblin proximo'
    }
  ])
  const hits = index.search('The paladin strikes the goblin', 3)
  assert.ok(hits.length >= 2)
  assert.equal(hits[0]?.original, 'The paladin strikes the goblin')
  assert.ok(hits.some((hit) => hit.original.includes('nearby goblin')))
  assert.equal(
    hits.some((hit) => hit.original === 'Open the inventory'),
    false
  )
})

test('limit is respected', () => {
  const corpus = Array.from({ length: 20 }, (_, i) => ({
    source: `Magic sword number ${i}`,
    target: `Espada magica ${i}`
  }))
  const hits = new SimilarityIndex(corpus).search('Magic sword number 3', 3)
  assert.equal(hits.length, 3)
})

test('add makes a new row searchable', () => {
  const index = new SimilarityIndex([{ source: 'Hello', target: 'Ola' }])
  index.add({ source: 'Thunderwave', target: 'Onda Trovejante' })
  const hits = index.search('Thunderwave', 1)
  assert.equal(hits[0]?.translated, 'Onda Trovejante')
  assert.equal(hits[0]?.score, 0)
})

test('XML tags in BG3 strings do not throw and can still match', () => {
  const source =
    'Inflict a -[1] penalty to the target\'s <LSTag Tooltip="Strength">Strength</LSTag>.'
  const index = new SimilarityIndex([
    { source, target: 'Aplique uma penalidade de -[1] em Forca.' },
    { source: 'Unrelated cheese', target: 'Queijo' }
  ])
  const hits = index.search(source, 2)
  assert.equal(hits[0]?.score, 0)
})

test('contained phrases beat shared function words', () => {
  const index = new SimilarityIndex([
    { source: 'I imagine each of us are carrying a piece of this burden', target: 'bad' },
    { source: 'Enhanced Elemental Armor', target: 'good' }
  ])
  const hits = index.search('Contains one of each Enhanced Elemental armor and jewelry piece', 5)
  assert.equal(hits[0]?.translated, 'good')
})

test('searchMany returns a hit list per uid', () => {
  const index = new SimilarityIndex([
    { source: 'Short sword', target: 'Espada curta' },
    { source: 'Longsword', target: 'Espada longa' }
  ])
  const hits = index.searchMany(
    [
      { uid: 'a', text: 'Short sword' },
      { uid: 'b', text: 'Longsword' }
    ],
    1
  )
  assert.equal(hits.get('a')?.[0]?.translated, 'Espada curta')
  assert.equal(hits.get('b')?.[0]?.translated, 'Espada longa')
})
