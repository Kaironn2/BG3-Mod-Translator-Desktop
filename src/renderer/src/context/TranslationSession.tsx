import { createContext, useCallback, useContext, useEffect, useReducer } from 'react'
import type { XmlEntry } from '@/types'

type Phase = 'idle' | 'loading' | 'loaded'

interface State {
  phase: Phase
  entries: XmlEntry[]
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
      return { ...state, entries: action.entries, phase: 'loaded' }
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
    case 'SET_MOD_NAME':
      return { ...state, modName: action.name }
    case 'SET_SOURCE_LANG':
      return { ...state, sourceLang: action.lang }
    case 'SET_TARGET_LANG':
      return { ...state, targetLang: action.lang }
    case 'SET_INPUT_PATH':
      return { ...state, inputPath: action.path }
    case 'RESET':
      return { ...state, phase: 'idle', entries: [], inputPath: null }
    default:
      return state
  }
}

interface TranslationSessionContext extends State {
  loadSession: (inputPath: string, sourceLang: string, targetLang: string) => Promise<void>
  updateEntry: (uid: string, target: string) => void
  markManual: (uid: string) => void
  setModName: (name: string) => void
  setSourceLang: (lang: string) => void
  setTargetLang: (lang: string) => void
  resetSession: () => void
}

const Context = createContext<TranslationSessionContext | null>(null)

const DEFAULT_SOURCE = 'English'
const DEFAULT_TARGET = 'Brazilian Portuguese'

export function TranslationSessionProvider({
  children
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const [state, dispatch] = useReducer(reducer, {
    phase: 'idle',
    entries: [],
    modName: '',
    sourceLang: DEFAULT_SOURCE,
    targetLang: DEFAULT_TARGET,
    inputPath: null
  })

  useEffect(() => {
    window.api.config.getAll().then((cfg) => {
      if (cfg['last_source_lang'])
        dispatch({ type: 'SET_SOURCE_LANG', lang: cfg['last_source_lang'] })
      if (cfg['last_target_lang'])
        dispatch({ type: 'SET_TARGET_LANG', lang: cfg['last_target_lang'] })
    })
  }, [])

  const loadSession = useCallback(
    async (inputPath: string, sourceLang: string, targetLang: string) => {
      dispatch({ type: 'SET_PHASE', phase: 'loading' })
      dispatch({ type: 'SET_INPUT_PATH', path: inputPath })
      const entries = await window.api.xml.load({ inputPath, sourceLang, targetLang })
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
