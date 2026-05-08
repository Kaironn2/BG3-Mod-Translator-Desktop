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

export const EMPTY_ENTRY_DRAFT: EntryDraft = {
  sourceLang: '',
  targetLang: '',
  sourceText: '',
  targetText: '',
  modName: '',
  uid: ''
}
