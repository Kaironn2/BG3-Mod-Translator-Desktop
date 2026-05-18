import type { BatchTranslationResult } from './deepl.service'
import { logError } from './log.service'
import { decodeEntities } from './xml-entities.service'

export type { BatchTranslationResult }

const GOOGLE_API_URL = 'https://translation.googleapis.com/language/translate/v2'
const GOOGLE_CHUNK_SIZE = 100
const MAX_RETRIES = 3

class GoogleApiError extends Error {
  constructor(
    public readonly status: number,
    detail: string
  ) {
    super(`Google API error ${status}: ${detail}`)
  }
}

function toGoogleLang(code: string): string {
  return code.toLowerCase()
}

export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string,
  apiKey: string,
  signal?: AbortSignal,
  onChars?: (count: number) => void
): Promise<string> {
  onChars?.(text.length)
  const translated = await requestGoogle([text], sourceLang, targetLang, apiKey, signal)
  const first = translated[0]
  if (first == null) {
    throw new Error('Google response did not include the translated text')
  }
  return decodeEntities(first)
}

export async function translateBatchDetailed(
  texts: string[],
  sourceLang: string,
  targetLang: string,
  apiKey: string,
  signal?: AbortSignal,
  onChars?: (count: number) => void
): Promise<BatchTranslationResult[]> {
  const results: BatchTranslationResult[] = []

  for (let offset = 0; offset < texts.length; offset += GOOGLE_CHUNK_SIZE) {
    const chunk = texts.slice(offset, offset + GOOGLE_CHUNK_SIZE)
    try {
      const chars = chunk.reduce((s, t) => s + t.length, 0)
      onChars?.(chars)
      const translated = await requestGoogle(chunk, sourceLang, targetLang, apiKey, signal)
      translated.forEach((value, i) => {
        results.push({ index: offset + i, translated: decodeEntities(value) })
      })
    } catch (err) {
      const chars = chunk.reduce((s, t) => s + t.length, 0)
      logError('google.batch.chunk', err, {
        offset,
        size: chunk.length,
        chars
      })
      if (isFatalBatchError(err)) {
        throw err
      }

      for (let i = 0; i < chunk.length; i++) {
        try {
          onChars?.(chunk[i].length)
          const translated = await translateText(chunk[i], sourceLang, targetLang, apiKey, signal)
          results.push({ index: offset + i, translated })
        } catch (entryErr) {
          if (isFatalBatchError(entryErr)) throw entryErr
          logError('google.batch.entry', entryErr, { index: offset + i, sourceLang, targetLang })
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

async function requestGoogle(
  texts: string[],
  sourceLang: string,
  targetLang: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<string[]> {
  const url = `${GOOGLE_API_URL}?key=${encodeURIComponent(apiKey)}`
  const body = JSON.stringify({
    q: texts,
    source: toGoogleLang(sourceLang),
    target: toGoogleLang(targetLang),
    format: 'html'
  })

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body,
      signal
    })

    if (response.ok) {
      const data = (await response.json()) as {
        data: { translations: { translatedText: string }[] }
      }
      return data.data.translations.map((item) => item.translatedText)
    }

    const detail = await response.text().catch(() => response.statusText)
    const error = new GoogleApiError(response.status, detail)
    if ([400, 401, 403].includes(response.status)) throw error
    if (response.status !== 429 || attempt === MAX_RETRIES) throw error
    logError('google.rateLimit', error, { attempt, total: texts.length })
    await delay(500 * attempt, signal)
  }

  throw new Error('Google request failed')
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
  return err instanceof GoogleApiError && [400, 401, 403].includes(err.status)
}
