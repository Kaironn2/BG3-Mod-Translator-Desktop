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
  apiKey: string,
  signal?: AbortSignal
): Promise<BatchTranslationResult[]> {
  const results: BatchTranslationResult[] = []

  for (let offset = 0; offset < texts.length; offset += DEEPL_CHUNK_SIZE) {
    const chunk = texts.slice(offset, offset + DEEPL_CHUNK_SIZE)
    try {
      const translated = await translateProtectedChunkDetailed(
        chunk,
        sourceLang,
        targetLang,
        apiKey,
        signal
      )
      translated.forEach((result, i) => results.push({ index: offset + i, ...result }))
    } catch (err) {
      logError('deepl.batch.chunk', err, { offset, size: chunk.length })
      if (isFatalBatchError(err)) {
        throw err
      }

      for (let i = 0; i < chunk.length; i++) {
        try {
          const translated = await translateText(
            chunk[i],
            sourceLang,
            targetLang,
            apiKey,
            undefined,
            signal
          )
          results.push({ index: offset + i, translated })
        } catch (entryErr) {
          if (isFatalBatchError(entryErr)) throw entryErr
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
  context?: string,
  signal?: AbortSignal
): Promise<string> {
  const { protectedText, tags } = protectTags(text)
  const translated = await requestDeepL(
    [protectedText],
    sourceLang,
    targetLang,
    apiKey,
    context,
    signal
  )
  const first = translated[0]
  if (first == null) {
    throw new Error('DeepL response did not include the translated text')
  }
  return restoreTags(first, tags, text)
}

async function translateProtectedChunkDetailed(
  texts: string[],
  sourceLang: string,
  targetLang: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<Array<Omit<BatchTranslationResult, 'index'>>> {
  const protectedTexts = texts.map(protectTags)
  const translated = await requestDeepL(
    protectedTexts.map((item) => item.protectedText),
    sourceLang,
    targetLang,
    apiKey,
    undefined,
    signal
  )

  return texts.map((text, index) => {
    const translatedText = translated[index]
    if (translatedText == null) {
      return {
        translated: null,
        error: `DeepL returned ${translated.length} of ${texts.length} translations`
      }
    }

    try {
      return {
        translated: restoreTags(translatedText, protectedTexts[index].tags, text)
      }
    } catch (err) {
      return {
        translated: null,
        error: err instanceof Error ? err.message : String(err)
      }
    }
  })
}

async function requestDeepL(
  texts: string[],
  sourceLang: string,
  targetLang: string,
  apiKey: string,
  context?: string,
  signal?: AbortSignal
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
      body: body.toString(),
      signal
    })

    if (response.ok) {
      const data = (await response.json()) as { translations: { text: string }[] }
      return data.translations.map((item) => item.text)
    }

    const detail = await response.text().catch(() => response.statusText)
    const error = new DeepLApiError(response.status, detail)
    if (response.status !== 429 || attempt === MAX_RETRIES) throw error
    logError('deepl.rateLimit', error, { attempt, total: texts.length })
    await delay(500 * attempt, signal)
  }

  throw new Error('DeepL request failed')
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    const onAbort = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      reject(signal?.reason ?? new Error('Translation cancelled'))
    }

    if (signal?.aborted) {
      onAbort()
      return
    }

    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

function isFatalBatchError(err: unknown): boolean {
  return err instanceof DeepLApiError && [401, 403, 456].includes(err.status)
}
