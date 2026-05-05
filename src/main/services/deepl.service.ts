const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate'

// DeepL expects language codes in UPPERCASE and uses 'PT-BR' format.
function toDeepLLang(code: string): string {
  return code.toUpperCase()
}

export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string,
  apiKey: string
): Promise<string> {
  const body = new URLSearchParams({
    text,
    source_lang: toDeepLLang(sourceLang),
    target_lang: toDeepLLang(targetLang)
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
  return data.translations[0]?.text ?? ''
}
