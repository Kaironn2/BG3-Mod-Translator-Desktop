import type { ReplaceDraft } from './types'

export function applyTextReplace(text: string, draft: ReplaceDraft): string {
  if (!draft.find) return text

  const pattern = draft.matchWholeWord
    ? `\\b${escapeRegExp(draft.find)}\\b`
    : escapeRegExp(draft.find)
  const flags = draft.matchCase ? 'g' : 'gi'
  const matcher = new RegExp(pattern, flags)

  return text
    .split(/(<[^>]+>)/g)
    .map((segment) =>
      segment.startsWith('<') && segment.endsWith('>')
        ? segment
        : segment.replace(matcher, () => draft.replaceWith)
    )
    .join('')
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
