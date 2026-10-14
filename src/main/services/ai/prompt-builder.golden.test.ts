import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { buildLinesBlock, parseGroupResponse } from './group-format'
import { DEFAULT_PROMPT, filterExamples, renderPrompt } from './prompt-builder'

// Golden contract against test-fixtures/group-format + prompt-builder: the sentinel
// marker block, the grouped-response parser and the rendered prompt (with the locked
// default template + filtered examples) are the wire surfaces the Rust port must
// reproduce exactly, or grouped AI translation breaks.

const FIXTURES = join('test-fixtures')

interface CaseSet {
  linesBlock: { sources: string[] }
  parseResponses: { name: string; expectedCount: number; raw: string; empty?: boolean }[]
}

const cases = JSON.parse(
  readFileSync(join(FIXTURES, 'group-format', 'responses.json'), 'utf-8')
) as CaseSet
const promptCases = JSON.parse(
  readFileSync(join(FIXTURES, 'prompt-builder', 'cases.json'), 'utf-8')
) as {
  renderPrompt: {
    template: string
    sourceText: string
    targetText: string
    sourceLangName: string
    targetLangName: string
  }
  filterExamples: {
    count: number
    minScore: number
    entries: { original: string; translated: string; score: number }[]
  }
}

test('golden: lines block locks the numbered marker layout', () => {
  const expected = JSON.parse(
    readFileSync(join(FIXTURES, 'group-format', 'expected-lines-block.json'), 'utf-8')
  ) as { sources: string[]; block: string }
  assert.equal(buildLinesBlock(expected.sources), expected.block)
})

for (const response of cases.parseResponses) {
  test(`golden: parse ${response.name}`, () => {
    const expected = JSON.parse(
      readFileSync(join(FIXTURES, 'group-format', 'expected-parse.json'), 'utf-8')
    ) as Array<{ name: string; parsed: Record<string, string> }>
    const locked = expected.find((caseRow) => caseRow.name === response.name)
    assert.ok(locked)
    const parsed = parseGroupResponse(response.raw, response.expectedCount)
    if (response.empty) {
      assert.deepEqual(Object.fromEntries(parsed), locked.parsed)
    } else {
      assert.deepEqual(Object.fromEntries(parsed), locked.parsed)
    }
  })
}

test('golden: filterExamples locks distance->similarity mapping and cutoff', () => {
  const examples = filterExamples(promptCases.filterExamples.entries, {
    count: promptCases.filterExamples.count,
    minScore: promptCases.filterExamples.minScore
  })
  assert.deepEqual(examples, [
    { src: 'Goblin Attack', tgt: 'Ataque dos Goblin' },
    { src: 'Goblin Outrider', tgt: 'Batedora Goblin' },
    { src: 'Saving Throw', tgt: 'Teste de Resistência' }
  ])
})

test('golden: rendered prompt locks template substitution + examples + response format', () => {
  const expected = JSON.parse(
    readFileSync(join(FIXTURES, 'prompt-builder', 'expected-render-prompt.json'), 'utf-8')
  ) as { prompt: string }
  const prompt = renderPrompt({
    ...promptCases.renderPrompt,
    examples: filterExamples(promptCases.filterExamples.entries, {
      count: promptCases.filterExamples.count,
      minScore: promptCases.filterExamples.minScore
    })
  })
  assert.equal(prompt, expected.prompt)
})

test('golden: default prompt render pins the locked template', () => {
  const expected = JSON.parse(
    readFileSync(join(FIXTURES, 'prompt-builder', 'expected-default-prompt.json'), 'utf-8')
  ) as { prompt: string }
  assert.ok(DEFAULT_PROMPT.startsWith('You are a translator specialized'))
  const prompt = renderPrompt({
    template: DEFAULT_PROMPT,
    sourceText: 'Saving Throw',
    targetText: '',
    sourceLangName: 'English',
    targetLangName: 'Brazilian Portuguese'
  })
  assert.equal(prompt, expected.prompt)
})
