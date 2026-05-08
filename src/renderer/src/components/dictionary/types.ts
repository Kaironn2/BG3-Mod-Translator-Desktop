export interface EntryDraft {
  sourceLang: string
  targetLang: string
  sourceText: string
  targetText: string
  modName: string
  uid: string
}

export interface DisplayEntry extends EntryDraft {
  id: number
  updatedAt: string | null
}

export type ReplaceScope = 'source' | 'target' | 'both'

export interface ReplaceDraft {
  find: string
  replaceWith: string
  scope: ReplaceScope
  matchCase: boolean
  matchWholeWord: boolean
}

export const EMPTY_ENTRY_DRAFT: EntryDraft = {
  sourceLang: '',
  targetLang: '',
  sourceText: '',
  targetText: '',
  modName: '',
  uid: ''
}

export const EMPTY_REPLACE_DRAFT: ReplaceDraft = {
  find: '',
  replaceWith: '',
  scope: 'target',
  matchCase: false,
  matchWholeWord: false
}
