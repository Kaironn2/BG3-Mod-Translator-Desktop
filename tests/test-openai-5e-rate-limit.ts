// Live smoke test: OpenAI + a few 5e Spells strings, through the same
// requestWithRateLimit helper the app uses.
//
// Usage: node --env-file=.env --experimental-strip-types tests/test-openai-5e-rate-limit.ts

import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { requestWithRateLimit, resetRateLimitState } from '../src/main/services/ai/rate-limit'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const apiKey = process.env.OPENAI_API_KEY?.trim()
if (!apiKey) {
  console.error(
    'OPENAI_API_KEY is not set. Run with: node --env-file=.env --experimental-strip-types tests/test-openai-5e-rate-limit.ts'
  )
  process.exit(1)
}

const FIVE_E_STRINGS = [
  'When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d6 for each slot level above 3rd.',
  'A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame.',
  'A beam of crackling, blue energy lances out toward a creature within range, forming a sustained arc of lightning between you and the target.'
]

async function maybeLoadFromMod(): Promise<string[]> {
  const xmlPath = join(
    root,
    'data',
    '5eSpells-125-2-4-3-0-1779638171',
    'unpacked',
    'Localization',
    'English',
    '5eSpells.xml'
  )
  try {
    const xml = await readFile(xmlPath, 'utf8')
    const matches = [...xml.matchAll(/contentuid="[^"]+"[^>]*>([^<]{40,220})</g)].map((m) =>
      m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    )
    if (matches.length >= 3) return matches.slice(0, 3)
  } catch {
    // unpacked xml is optional — fall back to the known 5e spell texts
  }
  return FIVE_E_STRINGS
}

async function translate(text: string): Promise<string> {
  const response = await requestWithRateLimit({
    providerId: 'openai',
    label: 'OpenAI',
    model: 'gpt-4o-mini',
    doRequest: () =>
      fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.3,
          messages: [
            {
              role: 'user',
              content: `Translate this Baldur's Gate 3 / D&D 5e spell text from English to Brazilian Portuguese. Return only the translation.\n\n${text}`
            }
          ]
        })
      })
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText)
    throw new Error(`OpenAI API error ${response.status}: ${detail}`)
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[]
  }
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

async function main(): Promise<void> {
  resetRateLimitState()
  const sources = await maybeLoadFromMod()
  console.log(`Translating ${sources.length} 5e-mod strings with gpt-4o-mini...\n`)

  for (const [i, source] of sources.entries()) {
    const started = Date.now()
    const translated = await translate(source)
    const ms = Date.now() - started
    if (!translated) throw new Error(`Empty translation for string ${i + 1}`)
    console.log(`#${i + 1} (${ms}ms)`)
    console.log(`  EN: ${source}`)
    console.log(`  PT: ${translated}\n`)
  }

  console.log('OpenAI 5e smoke test passed (bounded retries, no infinite loop).')
}

void main()
