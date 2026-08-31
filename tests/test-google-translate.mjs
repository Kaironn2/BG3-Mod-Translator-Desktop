// Smoke test for the Google Translate v2 REST API.
//
// Usage: node --env-file=.env tests/test-google-translate.mjs
//
// Requires GOOGLE_API_KEY in .env. Hits the real API with tiny throwaway
// phrases (total < 100 chars) to verify single, batch, tag preservation,
// and error paths. Self-contained: no imports from src/.

const GOOGLE_API_URL = 'https://translation.googleapis.com/language/translate/v2'

const apiKey = process.env.GOOGLE_API_KEY
if (!apiKey) {
  console.error(
    'GOOGLE_API_KEY is not set. Run with: node --env-file=.env tests/test-google-translate.mjs'
  )
  process.exit(1)
}

let charsSent = 0
const failures = []

async function request(texts, sourceLang, targetLang, key) {
  charsSent += texts.reduce((s, t) => s + t.length, 0)
  const url = `${GOOGLE_API_URL}?key=${encodeURIComponent(key)}`
  const body = JSON.stringify({
    q: texts,
    source: sourceLang.toLowerCase(),
    target: targetLang.toLowerCase(),
    format: 'html'
  })

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText)
    const err = new Error(`Google API error ${response.status}: ${detail}`)
    err.status = response.status
    throw err
  }

  const data = await response.json()
  return data.data.translations.map((t) => t.translatedText)
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`  FAIL: ${msg}`)
    failures.push(msg)
  }
}

// Test 1: single string
console.log('[1/4] Single string translation...')
try {
  const result = await request(['hi'], 'en', 'pt-BR', apiKey)
  console.log(`      result: ${JSON.stringify(result)}`)
  assert(Array.isArray(result) && result.length === 1, 'expected single-element array')
  assert(typeof result[0] === 'string' && result[0].length > 0, 'expected non-empty string')
} catch (err) {
  console.error(`  FAIL: ${err.message}`)
  failures.push(`test1: ${err.message}`)
}

// Test 2: HTML tag preservation
console.log('[2/4] Tag preservation...')
try {
  const result = await request(['hello <b>world</b>'], 'en', 'pt-BR', apiKey)
  console.log(`      result: ${JSON.stringify(result)}`)
  assert(result[0].includes('<b>'), 'expected <b> in output')
  assert(result[0].includes('</b>'), 'expected </b> in output')
} catch (err) {
  console.error(`  FAIL: ${err.message}`)
  failures.push(`test2: ${err.message}`)
}

// Test 3: batch
console.log('[3/4] Batch of 5...')
try {
  const result = await request(['cat', 'dog', 'sun', 'sky', 'tree'], 'en', 'pt-BR', apiKey)
  console.log(`      result: ${JSON.stringify(result)}`)
  assert(
    Array.isArray(result) && result.length === 5,
    `expected array of length 5, got ${result.length}`
  )
} catch (err) {
  console.error(`  FAIL: ${err.message}`)
  failures.push(`test3: ${err.message}`)
}

// Test 4: error path
console.log('[4/4] Invalid key rejection...')
try {
  const result = await request(['bad'], 'en', 'pt-BR', 'INVALID_KEY_XYZ')
  console.error(`  FAIL: expected throw, got ${JSON.stringify(result)}`)
  failures.push('test4: expected error, request succeeded')
} catch (err) {
  console.log(`      status: ${err.status}`)
  console.log(`      message: ${err.message.slice(0, 80)}`)
  assert(
    typeof err.status === 'number' && err.status >= 400 && err.status < 500,
    `expected 4xx status, got ${err.status}`
  )
}

console.log('')
console.log(`Total chars sent: ${charsSent}`)
if (failures.length === 0) {
  console.log('PASS')
  process.exit(0)
} else {
  console.error(`FAIL (${failures.length} issue(s))`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}
