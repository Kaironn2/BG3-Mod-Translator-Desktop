import type { ReplaceDraft } from './types'
import { protectReplaceRegions, restoreProtectedRegions } from './text'

export function applyTextReplace(text: string, draft: ReplaceDraft): string {
  if (!draft.find) return text

  const pattern = draft.matchWholeWord
    ? `\\b${escapeRegExp(draft.find)}\\b`
    : escapeRegExp(draft.find)
  const flags = draft.matchCase ? 'g' : 'gi'
  const matcher = new RegExp(pattern, flags)
  const { protectedText, regions } = protectReplaceRegions(text)

  return restoreProtectedRegions(
    protectedText.replace(matcher, () => draft.replaceWith),
    regions
  )
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
