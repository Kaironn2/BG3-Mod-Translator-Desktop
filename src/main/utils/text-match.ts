export interface TextMatchOptions {
  matchCase?: boolean
  wholeWord?: boolean
}

export interface TextReplaceDraft {
  find: string
  replaceWith: string
  matchCase?: boolean
  matchWholeWord?: boolean
}

const WORD_CHAR = '[\\p{L}\\p{N}_]'
const REPLACE_REGION_PATTERN = /(<[^>]+>|\{[^}]+\})/g
const PLACEHOLDER_PREFIX = '__ICOSA_DICT_REGION_'
const matcherCache = new Map<string, RegExp>()

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function getTextMatcher(
  query: string,
  options: TextMatchOptions = {},
  extra: { global?: boolean } = {}
): RegExp | null {
  const text = query.trim()
  if (!text) return null

  const key = `${options.matchCase ? 'c' : ''}${options.wholeWord ? 'w' : ''}${extra.global ? 'g' : ''}|${text}`
  const cached = matcherCache.get(key)
  if (cached) {
    cached.lastIndex = 0
    return cached
  }

  const escaped = escapeRegExp(text)
  const pattern = options.wholeWord ? `(?<!${WORD_CHAR})${escaped}(?!${WORD_CHAR})` : escaped
  const flags = `${extra.global ? 'g' : ''}${options.matchCase ? '' : 'i'}u`
  const matcher = new RegExp(pattern, flags)

  if (matcherCache.size >= 100) {
    const oldest = matcherCache.keys().next().value
    if (oldest !== undefined) matcherCache.delete(oldest)
  }
  matcherCache.set(key, matcher)
  return matcher
}

export function textMatches(query: string, value: string, options: TextMatchOptions = {}): boolean {
  const matcher = getTextMatcher(query, options)
  if (!matcher) return true
  return matcher.test(value)
}

export function applyTextReplace(text: string, draft: TextReplaceDraft): string {
  const matcher = getTextMatcher(
    draft.find,
    { matchCase: draft.matchCase, wholeWord: draft.matchWholeWord },
    { global: true }
  )
  if (!matcher) return text

  const { protectedText, regions } = protectReplaceRegions(text)
  return restoreProtectedRegions(
    protectedText.replace(matcher, () => draft.replaceWith),
    regions
  )
}

export function protectReplaceRegions(text: string): {
  protectedText: string
  regions: string[]
} {
  const regions: string[] = []
  const protectedText = text.replace(REPLACE_REGION_PATTERN, (segment) => {
    const index = regions.push(segment) - 1
    return `${PLACEHOLDER_PREFIX}${index}__`
  })
  return { protectedText, regions }
}

export function restoreProtectedRegions(text: string, regions: string[]): string {
  let restored = text
  for (let index = 0; index < regions.length; index++) {
    restored = restored.replaceAll(`${PLACEHOLDER_PREFIX}${index}__`, regions[index])
  }
  return restored
}
