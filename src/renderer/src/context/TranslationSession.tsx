import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react'
import { i18n } from '@/i18n'
import {
  DEFAULT_SOURCE_LANG,
  DEFAULT_TARGET_LANG,
  type XmlEntry,
  type XmlLoadProgress
} from '@/types'

export interface TranslationSessionEntry extends XmlEntry {
  rowId: string
}

type Phase = 'idle' | 'loading' | 'loaded'

export type FilterMode = 'all' | 'untranslated' | 'translated' | 'dictionary' | 'tags'
export type SourceTabMode = 'all' | 'xml' | 'loca'
export interface FilterSpec {
  mode: FilterMode
  search: string
  // Per-origin tab (.xml / .loca). 'all' means no file-type restriction.
  sourceTab?: SourceTabMode
}
export type SelectionState =
  | { kind: 'explicit'; uids: Set<string> }
  | { kind: 'all-matching'; filter: FilterSpec; excluded: Set<string> }

// private helpers - mirror predicates from TranslationGrid so entryMatchesFilter stays pure
function getCategory(entry: TranslationSessionEntry): 'dictionary' | 'tool' | 'manual' | 'none' {
  if (entry.matchType === 'mod-text' || entry.matchType === 'text') return 'dictionary'
  if (entry.matchType === 'manual') return 'manual'
  if (entry.target.trim()) return 'tool'
  return 'none'
}

function hasXmlTags(entry: TranslationSessionEntry): boolean {
  return /(<[^>]+>|\{[^}]+\})/.test(entry.source)
}

export function entryMatchesFilter(entry: TranslationSessionEntry, filter: FilterSpec): boolean {
  if (filter.mode === 'untranslated' && entry.target.trim()) return false
  if (filter.mode === 'translated' && !entry.target.trim()) return false
  if (filter.mode === 'dictionary' && getCategory(entry) !== 'dictionary') return false
  if (filter.mode === 'tags' && !hasXmlTags(entry)) return false
  if (filter.sourceTab === 'loca' && entry.sourceFileType !== 'loca') return false
  if (filter.sourceTab === 'xml' && entry.sourceFileType === 'loca') return false
  if (filter.search) {
    const query = filter.search.toLowerCase()
    return entry.source.toLowerCase().includes(query) || entry.target.toLowerCase().includes(query)
  }
  return true
}

export interface TranslationSessionState {
  phase: Phase
  loadingLabel: string
  loadingProgress: XmlLoadProgress | null
  entries: TranslationSessionEntry[]
  selection: SelectionState
  modName: string
  sourceLang: string
  targetLang: string
  inputPath: string | null
}

export function materializeSelectedEntries(
  state: TranslationSessionState
): TranslationSessionEntry[] {
  const { selection, entries } = state
  if (selection.kind === 'explicit') {
    return entries.filter((e) => selection.uids.has(e.rowId))
  }
  return entries.filter(
    (e) => entryMatchesFilter(e, selection.filter) && !selection.excluded.has(e.rowId)
  )
}

const EMPTY_EXPLICIT: SelectionState = { kind: 'explicit', uids: new Set() }

type Action =
  | { type: 'SET_PHASE'; phase: Phase; loadingLabel?: string }
  | { type: 'SET_LOADING_PROGRESS'; progress: XmlLoadProgress | null }
  | { type: 'SET_ENTRIES'; entries: TranslationSessionEntry[] }
  | { type: 'UPDATE_ENTRY'; rowId: string; target: string }
  | { type: 'MARK_MANUAL'; rowId: string }
  | { type: 'SELECT_ALL_MATCHING'; filter: FilterSpec }
  | { type: 'TOGGLE_ENTRY'; rowId: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_MOD_NAME'; name: string }
  | { type: 'SET_SOURCE_LANG'; lang: string }
  | { type: 'SET_TARGET_LANG'; lang: string }
  | { type: 'SET_INPUT_PATH'; path: string }
  | { type: 'RESET' }

function reducer(state: TranslationSessionState, action: Action): TranslationSessionState {
  switch (action.type) {
    case 'SET_PHASE':
      return {
        ...state,
        phase: action.phase,
        loadingLabel: action.phase === 'loading' ? (action.loadingLabel ?? state.loadingLabel) : ''
      }
    case 'SET_LOADING_PROGRESS':
      return { ...state, loadingProgress: action.progress }
    case 'SET_ENTRIES':
      return {
        ...state,
        entries: action.entries,
        selection: EMPTY_EXPLICIT,
        phase: 'loaded',
        loadingLabel: '',
        loadingProgress: null
      }
    case 'UPDATE_ENTRY':
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.rowId === action.rowId ? { ...e, target: action.target } : e
        )
      }
    case 'MARK_MANUAL':
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.rowId === action.rowId ? { ...e, matchType: 'manual' } : e
        )
      }
    case 'SELECT_ALL_MATCHING':
      return {
        ...state,
        selection: { kind: 'all-matching', filter: action.filter, excluded: new Set() }
      }
    case 'TOGGLE_ENTRY': {
      const { selection } = state
      if (selection.kind === 'explicit') {
        const uids = new Set(selection.uids)
        if (uids.has(action.rowId)) uids.delete(action.rowId)
        else uids.add(action.rowId)
        return { ...state, selection: { kind: 'explicit', uids } }
      }
      // all-matching: toggle exclusion (excluded = visually unchecked)
      const excluded = new Set(selection.excluded)
      if (excluded.has(action.rowId)) excluded.delete(action.rowId)
      else excluded.add(action.rowId)
      return { ...state, selection: { ...selection, excluded } }
    }
    case 'CLEAR_SELECTION':
      return { ...state, selection: EMPTY_EXPLICIT }
    case 'SET_MOD_NAME':
      return { ...state, modName: action.name }
    case 'SET_SOURCE_LANG':
      return { ...state, sourceLang: action.lang }
    case 'SET_TARGET_LANG':
      return { ...state, targetLang: action.lang }
    case 'SET_INPUT_PATH':
      return { ...state, inputPath: action.path }
    case 'RESET':
      return {
        ...state,
        phase: 'idle',
        loadingLabel: '',
        loadingProgress: null,
        entries: [],
        selection: EMPTY_EXPLICIT,
        inputPath: null
      }
    default:
      return state
  }
}

interface TranslationSessionContext extends TranslationSessionState {
  // new selection API
  selectAllMatching: (filter: FilterSpec) => void
  toggleEntry: (rowId: string) => void
  clearSelection: () => void
  isSelected: (rowId: string) => boolean
  selectedCount: number
  // compat shims - replaced in task 05
  /** @deprecated use isSelected */
  selectedUids: Set<string>
  /** @deprecated use toggleEntry */
  selectEntry: (rowId: string, selected: boolean) => void
  /** @deprecated use selectAllMatching */
  selectEntries: (rowIds: string[], selected: boolean) => void
  // other
  loadSession: (
    inputPath: string,
    sourceLang: string,
    targetLang: string,
    modName: string,
    options?: { storedPath?: string }
  ) => Promise<void>
  updateEntry: (rowId: string, target: string) => void
  markManual: (rowId: string) => void
  setModName: (name: string) => void
  setSourceLang: (lang: string) => void
  setTargetLang: (lang: string) => void
  resetSession: () => void
}

const Context = createContext<TranslationSessionContext | null>(null)

export function TranslationSessionProvider({
  children
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const [state, dispatch] = useReducer(reducer, {
    phase: 'idle',
    loadingLabel: '',
    loadingProgress: null,
    entries: [],
    selection: EMPTY_EXPLICIT,
    modName: '',
    sourceLang: DEFAULT_SOURCE_LANG,
    targetLang: DEFAULT_TARGET_LANG,
    inputPath: null
  })

  useEffect(() => {
    window.api.config.getAll().then((cfg) => {
      if (cfg.last_source_lang) dispatch({ type: 'SET_SOURCE_LANG', lang: cfg.last_source_lang })
      if (cfg.last_target_lang) dispatch({ type: 'SET_TARGET_LANG', lang: cfg.last_target_lang })
    })
  }, [])

  const loadSession = useCallback(
    async (
      inputPath: string,
      sourceLang: string,
      targetLang: string,
      modName: string,
      options?: { storedPath?: string }
    ) => {
      dispatch({
        type: 'SET_PHASE',
        phase: 'loading',
        loadingLabel: i18n.t('setup.loadingPreparingSession', { ns: 'translate' })
      })
      dispatch({ type: 'SET_INPUT_PATH', path: inputPath })
      dispatch({ type: 'SET_MOD_NAME', name: modName })
      const storedPath =
        options?.storedPath ??
        (await window.api.mod.storeFile({ modName, filePath: inputPath })).storedPath
      dispatch({
        type: 'SET_PHASE',
        phase: 'loading',
        loadingLabel: i18n.t('setup.loadingEntries', { ns: 'translate' })
      })
      const unsub = window.api.xml.onLoadProgress((p) => {
        dispatch({ type: 'SET_LOADING_PROGRESS', progress: p })
      })
      let entries: Awaited<ReturnType<typeof window.api.xml.load>>
      try {
        entries = await window.api.xml.load({
          inputPath: storedPath,
          sourceLang,
          targetLang,
          modName
        })
      } finally {
        unsub()
      }
      if (modName) {
        dispatch({
          type: 'SET_PHASE',
          phase: 'loading',
          loadingLabel: i18n.t('setup.loadingModData', { ns: 'translate' })
        })
        await window.api.mod.upsert({
          name: modName,
          totalStrings: entries.length > 0 ? entries.length : undefined,
          lastFilePath: storedPath
        })
      }
      dispatch({
        type: 'SET_ENTRIES',
        entries: entries.map((entry, index) => ({ ...entry, rowId: `row-${index}` }))
      })
    },
    []
  )

  const updateEntry = useCallback((rowId: string, target: string) => {
    dispatch({ type: 'UPDATE_ENTRY', rowId, target })
  }, [])

  const markManual = useCallback((rowId: string) => {
    dispatch({ type: 'MARK_MANUAL', rowId })
  }, [])

  const selectAllMatching = useCallback((filter: FilterSpec) => {
    dispatch({ type: 'SELECT_ALL_MATCHING', filter })
  }, [])

  const toggleEntry = useCallback((rowId: string) => {
    dispatch({ type: 'TOGGLE_ENTRY', rowId })
  }, [])

  const clearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTION' })
  }, [])

  const isSelected = useCallback(
    (rowId: string): boolean => {
      const { selection, entries } = state
      if (selection.kind === 'explicit') return selection.uids.has(rowId)
      const entry = entries.find((e) => e.rowId === rowId)
      if (!entry) return false
      return entryMatchesFilter(entry, selection.filter) && !selection.excluded.has(rowId)
    },
    [state]
  )

  const selectedCount = useMemo(() => {
    const { selection, entries } = state
    if (selection.kind === 'explicit') return selection.uids.size
    let count = 0
    for (const entry of entries) {
      if (entryMatchesFilter(entry, selection.filter) && !selection.excluded.has(entry.rowId)) {
        count++
      }
    }
    return count
  }, [state])

  // compat shim: materializes Set<string> for legacy consumers (task 05 removes)
  const selectedUids = useMemo(() => {
    const { selection, entries } = state
    if (selection.kind === 'explicit') return selection.uids
    const result = new Set<string>()
    for (const entry of entries) {
      if (entryMatchesFilter(entry, selection.filter) && !selection.excluded.has(entry.rowId)) {
        result.add(entry.rowId)
      }
    }
    return result
  }, [state])

  // compat shim: maps old per-row select to toggleEntry (task 05 removes)
  const selectEntry = useCallback(
    (rowId: string, selected: boolean) => {
      if (isSelected(rowId) !== selected) dispatch({ type: 'TOGGLE_ENTRY', rowId })
    },
    [isSelected]
  )

  // compat shim: maps old bulk select to individual toggles (task 05 removes)
  const selectEntries = useCallback(
    (rowIds: string[], selected: boolean) => {
      for (const rowId of rowIds) {
        if (isSelected(rowId) !== selected) dispatch({ type: 'TOGGLE_ENTRY', rowId })
      }
    },
    [isSelected]
  )

  const setModName = useCallback((name: string) => {
    dispatch({ type: 'SET_MOD_NAME', name })
  }, [])

  const setSourceLang = useCallback((lang: string) => {
    dispatch({ type: 'SET_SOURCE_LANG', lang })
  }, [])

  const setTargetLang = useCallback((lang: string) => {
    dispatch({ type: 'SET_TARGET_LANG', lang })
  }, [])

  const resetSession = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  return (
    <Context.Provider
      value={{
        ...state,
        selectAllMatching,
        toggleEntry,
        clearSelection,
        isSelected,
        selectedCount,
        selectedUids,
        selectEntry,
        selectEntries,
        loadSession,
        updateEntry,
        markManual,
        setModName,
        setSourceLang,
        setTargetLang,
        resetSession
      }}
    >
      {children}
    </Context.Provider>
  )
}

export function useTranslationSession(): TranslationSessionContext {
  const ctx = useContext(Context)
  if (!ctx) throw new Error('useTranslationSession must be used inside TranslationSessionProvider')
  return ctx
}
