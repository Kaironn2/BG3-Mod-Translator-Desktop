// Smoke test for DeepL source/target codes used by the app map.
//
// Usage: node --env-file=.env scripts/test-deepl-langs.mjs
//
// Requires DEEPL_API_KEY in .env. Hits the real API with tiny throwaway
// phrases. Self-contained: no imports from src/. Never prints the key.
//
// Expected rejects (400) are success: DeepL variants are target-only.

const apiKey = process.env.DEEPL_API_KEY?.trim()
if (!apiKey) {
  console.error(
    'DEEPL_API_KEY is not set. Run with: node --env-file=.env scripts/test-deepl-langs.mjs'
  )
  process.exit(1)
}

const API_BASE = apiKey.includes(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com'

async function deepl(path, { method = 'GET', body } = {}) {
  const headers = { Authorization: `DeepL-Auth-Key ${apiKey}` }
  let payload
  if (body) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    payload = body
  }
  const response = await fetch(`${API_BASE}${path}`, { method, headers, body: payload })
  const text = await response.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = text
  }
  return { status: response.status, ok: response.ok, json }
}

function redact(value) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value)
  return raw.replaceAll(apiKey, '[redacted]')
}

async function listLangs(type) {
  const result = await deepl(`/v2/languages?type=${type}`)
  if (!result.ok) {
    console.error(`languages?type=${type} -> ${result.status} ${redact(result.json)}`)
    return []
  }
  return result.json.map((row) => row.language)
}

async function translate(text, sourceLang, targetLang) {
  const body = new URLSearchParams()
  body.append('text', text)
  body.append('source_lang', sourceLang)
  body.append('target_lang', targetLang)
  const result = await deepl('/v2/translate', { method: 'POST', body })
  if (!result.ok) {
    return { ok: false, status: result.status, error: redact(result.json) }
  }
  const translation = result.json.translations?.[0]
  return {
    ok: true,
    status: result.status,
    detected: translation?.detected_source_language,
    text: translation?.text
  }
}

const sourceLangs = await listLangs('source')
const targetLangs = await listLangs('target')
const interesting = [
  'ZH',
  'ZH-HANS',
  'ZH-HANT',
  'ZH-CN',
  'ZH-TW',
  'EN',
  'EN-US',
  'PT',
  'PT-BR',
  'PT-PT',
  'ES',
  'ES-419'
]

console.log(`host: ${API_BASE}`)
console.log(
  'source has:',
  interesting.filter((code) => sourceLangs.includes(code)).join(', ') ||
    '(none of the interesting codes)'
)
console.log(
  'target has:',
  interesting.filter((code) => targetLangs.includes(code)).join(', ') ||
    '(none of the interesting codes)'
)

const cases = [
  {
    label: 'map zh-CN source ZH -> EN-US',
    text: '火球',
    source: 'ZH',
    target: 'EN-US',
    expect: 'ok'
  },
  {
    label: 'variant source ZH-HANS',
    text: '火球',
    source: 'ZH-HANS',
    target: 'EN-US',
    expect: 'reject'
  },
  {
    label: 'invalid source ZH-CN',
    text: '火球',
    source: 'ZH-CN',
    target: 'EN-US',
    expect: 'reject'
  },
  {
    label: 'map zh-TW source ZH -> EN-US',
    text: '火球術',
    source: 'ZH',
    target: 'EN-US',
    expect: 'ok'
  },
  {
    label: 'variant source ZH-HANT',
    text: '火球術',
    source: 'ZH-HANT',
    target: 'EN-US',
    expect: 'reject'
  },
  {
    label: 'invalid source ZH-TW',
    text: '火球術',
    source: 'ZH-TW',
    target: 'EN-US',
    expect: 'reject'
  },
  {
    label: 'map pt-BR source PT -> EN-US',
    text: 'bola de fogo',
    source: 'PT',
    target: 'EN-US',
    expect: 'ok'
  },
  {
    label: 'old source PT-BR',
    text: 'bola de fogo',
    source: 'PT-BR',
    target: 'EN-US',
    expect: 'reject'
  },
  { label: 'map en -> PT-BR', text: 'fireball', source: 'EN', target: 'PT-BR', expect: 'ok' },
  { label: 'map es-419 target', text: 'fireball', source: 'EN', target: 'ES-419', expect: 'ok' },
  {
    label: 'map zh-CN target ZH-HANS',
    text: 'fireball',
    source: 'EN',
    target: 'ZH-HANS',
    expect: 'ok'
  },
  {
    label: 'map zh-TW target ZH-HANT',
    text: 'fireball',
    source: 'EN',
    target: 'ZH-HANT',
    expect: 'ok'
  }
]

const failures = []
console.log('')
for (const test of cases) {
  const result = await translate(test.text, test.source, test.target)
  const passed = test.expect === 'ok' ? result.ok : !result.ok
  if (passed) {
    console.log(`OK   ${test.label}`)
    if (result.ok) {
      console.log(`     detected=${result.detected} text=${JSON.stringify(result.text)}`)
    } else {
      console.log(`     rejected ${result.status}`)
    }
  } else {
    const detail = result.ok
      ? `expected reject, got ${JSON.stringify(result.text)}`
      : `expected ok, got ${result.status} ${result.error}`
    console.error(`FAIL ${test.label}`)
    console.error(`     ${detail}`)
    failures.push(`${test.label}: ${detail}`)
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} failure(s)`)
  process.exit(1)
}
console.log('\nAll DeepL language-code checks passed.')
