import { createContext, useCallback, useContext, useEffect, useReducer } from 'react'
import type { XmlEntry } from '@/types'

export interface TranslationSessionEntry extends XmlEntry {
  rowId: string
}

type Phase = 'idle' | 'loading' | 'loaded'

interface State {
  phase: Phase
  loadingLabel: string
  entries: TranslationSessionEntry[]
  selectedUids: Set<string>
  modName: string
  sourceLang: string
  targetLang: string
  inputPath: string | null
}

type Action =
  | { type: 'SET_PHASE'; phase: Phase; loadingLabel?: string }
  | { type: 'SET_ENTRIES'; entries: TranslationSessionEntry[] }
  | { type: 'UPDATE_ENTRY'; rowId: string; target: string }
  | { type: 'MARK_MANUAL'; rowId: string }
  | { type: 'SELECT_ENTRY'; rowId: string; selected: boolean }
  | { type: 'SELECT_ENTRIES'; rowIds: string[]; selected: boolean }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_MOD_NAME'; name: string }
  | { type: 'SET_SOURCE_LANG'; lang: string }
  | { type: 'SET_TARGET_LANG'; lang: string }
  | { type: 'SET_INPUT_PATH'; path: string }
  | { type: 'RESET' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_PHASE':
      return {
        ...state,
        phase: action.phase,
        loadingLabel: action.phase === 'loading' ? (action.loadingLabel ?? state.loadingLabel) : ''
      }
    case 'SET_ENTRIES':
      return {
        ...state,
        entries: action.entries,
        selectedUids: new Set<string>(),
        phase: 'loaded',
        loadingLabel: ''
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
    case 'SELECT_ENTRY': {
      const selectedUids = new Set(state.selectedUids)
      if (action.selected) selectedUids.add(action.rowId)
      else selectedUids.delete(action.rowId)
      return { ...state, selectedUids }
    }
    case 'SELECT_ENTRIES': {
      const selectedUids = new Set(state.selectedUids)
      for (const rowId of action.rowIds) {
        if (action.selected) selectedUids.add(rowId)
        else selectedUids.delete(rowId)
      }
      return { ...state, selectedUids }
    }
    case 'CLEAR_SELECTION':
      return { ...state, selectedUids: new Set<string>() }
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
        entries: [],
        selectedUids: new Set<string>(),
        inputPath: null
      }
    default:
      return state
  }
}

interface TranslationSessionContext extends State {
  loadSession: (
    inputPath: string,
    sourceLang: string,
    targetLang: string,
    modName: string,
    options?: { storedPath?: string }
  ) => Promise<void>
  updateEntry: (rowId: string, target: string) => void
  markManual: (rowId: string) => void
  selectEntry: (rowId: string, selected: boolean) => void
  selectEntries: (rowIds: string[], selected: boolean) => void
  clearSelection: () => void
  setModName: (name: string) => void
  setSourceLang: (lang: string) => void
  setTargetLang: (lang: string) => void
  resetSession: () => void
}

const Context = createContext<TranslationSessionContext | null>(null)

const DEFAULT_SOURCE = 'en'
const DEFAULT_TARGET = 'pt-BR'

export function TranslationSessionProvider({
  children
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const [state, dispatch] = useReducer(reducer, {
    phase: 'idle',
    loadingLabel: '',
    entries: [],
    selectedUids: new Set<string>(),
    modName: '',
    sourceLang: DEFAULT_SOURCE,
    targetLang: DEFAULT_TARGET,
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
        loadingLabel: 'Preparando sessao de traducao...'
      })
      dispatch({ type: 'SET_INPUT_PATH', path: inputPath })
      dispatch({ type: 'SET_MOD_NAME', name: modName })
      const storedPath =
        options?.storedPath ??
        (await window.api.mod.storeFile({ modName, filePath: inputPath })).storedPath
      dispatch({
        type: 'SET_PHASE',
        phase: 'loading',
        loadingLabel: 'Carregando entradas do XML...'
      })
      const entries = await window.api.xml.load({
        inputPath: storedPath,
        sourceLang,
        targetLang,
        modName
      })
      if (modName) {
        dispatch({
          type: 'SET_PHASE',
          phase: 'loading',
          loadingLabel: 'Atualizando dados do mod...'
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

  const selectEntry = useCallback((rowId: string, selected: boolean) => {
    dispatch({ type: 'SELECT_ENTRY', rowId, selected })
  }, [])

  const selectEntries = useCallback((rowIds: string[], selected: boolean) => {
    dispatch({ type: 'SELECT_ENTRIES', rowIds, selected })
  }, [])

  const clearSelection = useCallback(() => {
    dispatch({ type: 'CLEAR_SELECTION' })
  }, [])

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
        loadSession,
        updateEntry,
        markManual,
        selectEntry,
        selectEntries,
        clearSelection,
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
