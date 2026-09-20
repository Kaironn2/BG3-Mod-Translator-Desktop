import { getTextMatcher, type TextSearchOptions } from '@/utils/textSearch'

export function highlightText(
  text: string,
  query: string,
  options: TextSearchOptions = {}
): React.ReactNode {
  const matcher = getTextMatcher(query, options, { global: true })
  if (!matcher) return text

  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match = matcher.exec(text)
  while (match) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    parts.push(
      <mark key={match.index} className="rounded-sm bg-amber-500/35 text-inherit">
        {match[0]}
      </mark>
    )
    lastIndex = match.index + match[0].length
    if (match[0].length === 0) matcher.lastIndex += 1
    match = matcher.exec(text)
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts.length > 0 ? parts : text
}
