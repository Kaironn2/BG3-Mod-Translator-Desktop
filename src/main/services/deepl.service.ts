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

interface ProtectedTag {
  name: string
  kind: 'open' | 'close' | 'self'
  original: string
}

interface ProtectedText {
  protectedText: string
  tags: ProtectedTag[]
}

interface TagToken {
  raw: string
  name: string
  start: number
  isClosing: boolean
  isSelfClosing: boolean
  replacement?: string
}

const TAG_RE = /<\/?[a-zA-Z][a-zA-Z0-9]*[^<>]*>/g
const WRAPPER_TAG = 'icosa-root'

function toDeepLLang(code: string): string {
  return code.toUpperCase()
}

function protectTags(text: string): ProtectedText {
  const decoded = decodeEntities(text)
  const tags: ProtectedTag[] = []
  const tokens = Array.from(decoded.matchAll(TAG_RE), (match) =>
    createTagToken(match[0], match.index ?? 0)
  )

  const stackByName = new Map<string, TagToken[]>()
  let placeholderIndex = 0

  for (const token of tokens) {
    if (token.isSelfClosing) {
      assignSelfClosingPlaceholder(token, placeholderIndex++, tags)
      continue
    }

    if (token.isClosing) {
      const stack = stackByName.get(token.name)
      const opening = stack?.pop()
      if (!opening) {
        assignSelfClosingPlaceholder(token, placeholderIndex++, tags)
        continue
      }

      const placeholderName = createPlaceholderName(placeholderIndex++)
      opening.replacement = `<${placeholderName}>`
      token.replacement = `</${placeholderName}>`
      tags.push(
        { name: placeholderName, kind: 'open', original: opening.raw },
        { name: placeholderName, kind: 'close', original: token.raw }
      )
      continue
    }

    const stack = stackByName.get(token.name)
    if (stack) stack.push(token)
    else stackByName.set(token.name, [token])
  }

  for (const stack of stackByName.values()) {
    for (const token of stack) {
      assignSelfClosingPlaceholder(token, placeholderIndex++, tags)
    }
  }

  let cursor = 0
  let protectedBody = ''
  for (const token of tokens) {
    protectedBody += escapeXmlText(decoded.slice(cursor, token.start))
    protectedBody += token.replacement ?? escapeXmlText(token.raw)
    cursor = token.start + token.raw.length
  }
  protectedBody += escapeXmlText(decoded.slice(cursor))

  return { protectedText: wrapXmlContent(protectedBody), tags }
}

function restoreTags(text: string, tags: ProtectedTag[], originalText: string): string {
  let restored = decodeEntities(unwrapXmlContent(text))
  for (const tag of tags) {
    const placeholder = placeholderPattern(tag)
    if (!placeholder.test(restored)) {
      throw new Error(`DeepL response did not preserve placeholder ${tag.name}`)
    }
    restored = restored.replace(placeholder, tag.original)
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
  body.append('tag_handling', 'xml')
  body.append('tag_handling_version', 'v2')
  body.append('split_sentences', 'nonewlines')
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

function createTagToken(raw: string, start: number): TagToken {
  const nameMatch = raw.match(/^<\/?([a-zA-Z][a-zA-Z0-9]*)/)
  if (!nameMatch) {
    throw new Error(`Unable to parse tag token: ${raw}`)
  }

  return {
    raw,
    name: nameMatch[1],
    start,
    isClosing: raw.startsWith('</'),
    isSelfClosing: raw.endsWith('/>')
  }
}

function assignSelfClosingPlaceholder(
  token: TagToken,
  index: number,
  tags: ProtectedTag[]
): void {
  const placeholderName = createPlaceholderName(index)
  token.replacement = `<${placeholderName}/>`
  tags.push({ name: placeholderName, kind: 'self', original: token.raw })
}

function createPlaceholderName(index: number): string {
  return `icosa-${index}`
}

function wrapXmlContent(text: string): string {
  return `<${WRAPPER_TAG}>${text}</${WRAPPER_TAG}>`
}

function unwrapXmlContent(text: string): string {
  const match = text
    .trim()
    .match(new RegExp(`^<${WRAPPER_TAG}>([\\s\\S]*)</${WRAPPER_TAG}>$`))
  if (!match) {
    throw new Error('DeepL response did not preserve the XML wrapper')
  }
  return match[1]
}

function escapeXmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function placeholderPattern(tag: ProtectedTag): RegExp {
  const name = escapeRegExp(tag.name)
  if (tag.kind === 'self') {
    return new RegExp(`<${name}\\s*/>`)
  }
  if (tag.kind === 'close') {
    return new RegExp(`</${name}>`)
  }
  return new RegExp(`<${name}>`)
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
