import { createContext, useCallback, useContext, useEffect, useReducer } from 'react'
import type { XmlEntry } from '@/types'

type Phase = 'idle' | 'loading' | 'loaded'

interface State {
  phase: Phase
  entries: XmlEntry[]
  selectedUids: Set<string>
  modName: string
  sourceLang: string
  targetLang: string
  inputPath: string | null
}

type Action =
  | { type: 'SET_PHASE'; phase: Phase }
  | { type: 'SET_ENTRIES'; entries: XmlEntry[] }
  | { type: 'UPDATE_ENTRY'; uid: string; target: string }
  | { type: 'MARK_MANUAL'; uid: string }
  | { type: 'SELECT_ENTRY'; uid: string; selected: boolean }
  | { type: 'SELECT_ENTRIES'; uids: string[]; selected: boolean }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_MOD_NAME'; name: string }
  | { type: 'SET_SOURCE_LANG'; lang: string }
  | { type: 'SET_TARGET_LANG'; lang: string }
  | { type: 'SET_INPUT_PATH'; path: string }
  | { type: 'RESET' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_PHASE':
      return { ...state, phase: action.phase }
    case 'SET_ENTRIES':
      return { ...state, entries: action.entries, selectedUids: new Set<string>(), phase: 'loaded' }
    case 'UPDATE_ENTRY':
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.uid === action.uid ? { ...e, target: action.target } : e
        )
      }
    case 'MARK_MANUAL':
      return {
        ...state,
        entries: state.entries.map((e) =>
          e.uid === action.uid ? { ...e, matchType: 'manual' } : e
        )
      }
    case 'SELECT_ENTRY': {
      const selectedUids = new Set(state.selectedUids)
      if (action.selected) selectedUids.add(action.uid)
      else selectedUids.delete(action.uid)
      return { ...state, selectedUids }
    }
    case 'SELECT_ENTRIES': {
      const selectedUids = new Set(state.selectedUids)
      for (const uid of action.uids) {
        if (action.selected) selectedUids.add(uid)
        else selectedUids.delete(uid)
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
    modName: string
  ) => Promise<void>
  updateEntry: (uid: string, target: string) => void
  markManual: (uid: string) => void
  selectEntry: (uid: string, selected: boolean) => void
  selectEntries: (uids: string[], selected: boolean) => void
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
    async (inputPath: string, sourceLang: string, targetLang: string, modName: string) => {
      dispatch({ type: 'SET_PHASE', phase: 'loading' })
      dispatch({ type: 'SET_INPUT_PATH', path: inputPath })
      dispatch({ type: 'SET_MOD_NAME', name: modName })
      const [{ storedPath }, entries] = await Promise.all([
        window.api.mod.storeFile({ modName, filePath: inputPath }),
        window.api.xml.load({ inputPath, sourceLang, targetLang })
      ])
      if (modName) {
        await window.api.mod.upsert({
          name: modName,
          totalStrings: entries.length > 0 ? entries.length : undefined,
          lastFilePath: storedPath
        })
      }
      dispatch({ type: 'SET_ENTRIES', entries })
    },
    []
  )

  const updateEntry = useCallback((uid: string, target: string) => {
    dispatch({ type: 'UPDATE_ENTRY', uid, target })
  }, [])

  const markManual = useCallback((uid: string) => {
    dispatch({ type: 'MARK_MANUAL', uid })
  }, [])

  const selectEntry = useCallback((uid: string, selected: boolean) => {
    dispatch({ type: 'SELECT_ENTRY', uid, selected })
  }, [])

  const selectEntries = useCallback((uids: string[], selected: boolean) => {
    dispatch({ type: 'SELECT_ENTRIES', uids, selected })
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
