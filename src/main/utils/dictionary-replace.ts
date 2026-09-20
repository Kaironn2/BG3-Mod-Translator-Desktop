import { applyTextReplace } from './text-match'

export type DictionaryReplaceScope = 'source' | 'target' | 'both'

export interface DictionaryReplacePatch {
  findText: string
  replaceText: string
  scope: DictionaryReplaceScope
  matchCase?: boolean
  matchWholeWord?: boolean
}

export interface DictionaryReplaceEntry {
  id: number
  language1: string
  language2: string
  textLanguage1: string
  textLanguage2: string
}

export function isDictionaryDisplaySwapped(
  entry: { language1: string; language2: string },
  filters: { sourceLang?: string; targetLang?: string }
): boolean {
  const sourceLang = filters.sourceLang?.trim()
  const targetLang = filters.targetLang?.trim()
  if (sourceLang && targetLang) return entry.language1 !== sourceLang
  if (sourceLang) return entry.language2 === sourceLang
  if (targetLang) return entry.language1 === targetLang
  return false
}

export function applyDictionaryReplacePatch(
  entry: DictionaryReplaceEntry,
  filters: { sourceLang?: string; targetLang?: string },
  patch: DictionaryReplacePatch
): { id: number; textLanguage1: string; textLanguage2: string } | null {
  const swap = isDictionaryDisplaySwapped(entry, filters)
  const source = swap ? entry.textLanguage2 : entry.textLanguage1
  const target = swap ? entry.textLanguage1 : entry.textLanguage2
  const draft = {
    find: patch.findText,
    replaceWith: patch.replaceText,
    matchCase: patch.matchCase,
    matchWholeWord: patch.matchWholeWord
  }

  const nextSource = patch.scope === 'target' ? source : applyTextReplace(source, draft)
  const nextTarget = patch.scope === 'source' ? target : applyTextReplace(target, draft)
  if (nextSource === source && nextTarget === target) return null

  return {
    id: entry.id,
    textLanguage1: swap ? nextTarget : nextSource,
    textLanguage2: swap ? nextSource : nextTarget
  }
}
