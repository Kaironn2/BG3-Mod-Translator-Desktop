import { decodeEntities, encodeEntities } from './xml-entities.service'

const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate'

function toDeepLLang(code: string): string {
  return code.toUpperCase()
}

function extractTagNames(text: string): string[] {
  const matches = text.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)[^>]*>/g)
  return [...new Set([...matches].map((m) => m[1]))]
}

export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string,
  apiKey: string,
  context?: string
): Promise<string> {
  const decoded = decodeEntities(text)
  const tagNames = extractTagNames(decoded)

  const body = new URLSearchParams({
    text: decoded,
    source_lang: toDeepLLang(sourceLang),
    target_lang: toDeepLLang(targetLang),
    tag_handling: 'xml',
    ...(tagNames.length > 0 && { ignore_tags: tagNames.join(',') }),
    ...(context && { context }),
  })

  const response = await fetch(DEEPL_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText)
    throw new Error(`DeepL API error ${response.status}: ${detail}`)
  }

  const data = (await response.json()) as { translations: { text: string }[] }
  const translated = data.translations[0]?.text ?? ''
  return tagNames.length > 0 ? encodeEntities(translated) : translated
}
