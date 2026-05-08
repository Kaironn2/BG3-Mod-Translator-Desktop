import type { ReplaceDraft } from './types'

export function applyTextReplace(text: string, draft: ReplaceDraft): string {
  if (!draft.find) return text

  const pattern = draft.matchWholeWord
    ? `\\b${escapeRegExp(draft.find)}\\b`
    : escapeRegExp(draft.find)
  const flags = draft.matchCase ? 'g' : 'gi'
  const matcher = new RegExp(pattern, flags)

  return text.replace(matcher, () => draft.replaceWith)
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
