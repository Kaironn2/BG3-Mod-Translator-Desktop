import { decodeEntities, encodeEntities } from './xml-entities.service'
import { logError } from './log.service'

const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate'
const DEEPL_CHUNK_SIZE = 50
const MAX_RETRIES = 3

class DeepLApiError extends Error {
  constructor(
    public readonly status: number,
    detail: string
  ) {
    super(`DeepL API error ${status}: ${detail}`)
  }
}

export interface BatchTranslationResult {
  index: number
  translated: string | null
  error?: string
}

function toDeepLLang(code: string): string {
  return code.toUpperCase()
}

function protectTags(text: string): {
  protectedText: string
  tags: string[]
} {
  const tags: string[] = []
  const protectedText = decodeEntities(text).replace(
    /<\/?[a-zA-Z][a-zA-Z0-9]*[^<>]*>/g,
    (tag) => {
      const index = tags.push(tag) - 1
      return `xXxICOSA${index}TAGxXx`
    }
  )
  return { protectedText, tags }
}

function restoreTags(text: string, tags: string[], originalText: string): string {
  let restored = text
  for (let i = 0; i < tags.length; i++) {
    const placeholder = `xXxICOSA${i}TAGxXx`
    if (!restored.includes(placeholder)) {
      throw new Error(`DeepL response did not preserve placeholder ${placeholder}`)
    }
    restored = restored.replaceAll(placeholder, tags[i])
  }

  return tags.length > 0 || originalText.includes('&lt;') ? encodeEntities(restored) : restored
}

export async function translateBatchDetailed(
  texts: string[],
  sourceLang: string,
  targetLang: string,
  apiKey: string
): Promise<BatchTranslationResult[]> {
  const results: BatchTranslationResult[] = []

  for (let offset = 0; offset < texts.length; offset += DEEPL_CHUNK_SIZE) {
    const chunk = texts.slice(offset, offset + DEEPL_CHUNK_SIZE)
    try {
      const translated = await translateProtectedChunk(chunk, sourceLang, targetLang, apiKey)
      translated.forEach((text, i) => results.push({ index: offset + i, translated: text }))
    } catch (err) {
      logError('deepl.batch.chunk', err, { offset, size: chunk.length })
      if (isFatalBatchError(err)) {
        const error = err instanceof Error ? err.message : String(err)
        chunk.forEach((_text, i) =>
          results.push({ index: offset + i, translated: null, error })
        )
        continue
      }

      for (let i = 0; i < chunk.length; i++) {
        try {
          const translated = await translateText(chunk[i], sourceLang, targetLang, apiKey)
          results.push({ index: offset + i, translated })
        } catch (entryErr) {
          logError('deepl.batch.entry', entryErr, { index: offset + i, sourceLang, targetLang })
          results.push({
            index: offset + i,
            translated: null,
            error: entryErr instanceof Error ? entryErr.message : String(entryErr)
          })
        }
      }
    }
  }

  return results
}

export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string,
  apiKey: string,
  context?: string
): Promise<string> {
  const { protectedText, tags } = protectTags(text)
  const translated = await requestDeepL([protectedText], sourceLang, targetLang, apiKey, context)
  return restoreTags(translated[0] ?? '', tags, text)
}

async function translateProtectedChunk(
  texts: string[],
  sourceLang: string,
  targetLang: string,
  apiKey: string
): Promise<string[]> {
  const protectedTexts = texts.map(protectTags)
  const translated = await requestDeepL(
    protectedTexts.map((item) => item.protectedText),
    sourceLang,
    targetLang,
    apiKey
  )

  return texts.map((text, index) =>
    restoreTags(translated[index] ?? '', protectedTexts[index].tags, text)
  )
}

async function requestDeepL(
  texts: string[],
  sourceLang: string,
  targetLang: string,
  apiKey: string,
  context?: string
): Promise<string[]> {
  const body = new URLSearchParams()
  for (const text of texts) body.append('text', text)
  body.append('source_lang', toDeepLLang(sourceLang))
  body.append('target_lang', toDeepLLang(targetLang))
  if (context) body.append('context', context)

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(DEEPL_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    })

    if (response.ok) {
      const data = (await response.json()) as { translations: { text: string }[] }
      return data.translations.map((item) => item.text)
    }

    const detail = await response.text().catch(() => response.statusText)
    const error = new DeepLApiError(response.status, detail)
    if (response.status !== 429 || attempt === MAX_RETRIES) throw error
    logError('deepl.rateLimit', error, { attempt, total: texts.length })
    await delay(500 * attempt)
  }

  throw new Error('DeepL request failed')
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isFatalBatchError(err: unknown): boolean {
  return err instanceof DeepLApiError && [401, 403, 456].includes(err.status)
}
