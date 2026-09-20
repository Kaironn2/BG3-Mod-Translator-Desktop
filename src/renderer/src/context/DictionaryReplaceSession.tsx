import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type {
  DictionaryFilters,
  DictionaryReplacePatch,
  DictionaryReplaceProgressUpdate
} from '@/types'

export type DictionaryReplaceStatus = 'idle' | 'running' | 'done' | 'error'

export interface DictionaryReplaceSessionValue {
  status: DictionaryReplaceStatus
  phase: DictionaryReplaceProgressUpdate['phase'] | null
  processed: number
  total: number
  lastUpdated: number
  running: boolean
  startByIds: (
    ids: number[],
    filters: DictionaryFilters,
    patch: DictionaryReplacePatch
  ) => Promise<void>
  startByFilter: (filters: DictionaryFilters, patch: DictionaryReplacePatch) => Promise<void>
  acknowledge: () => void
}

const DictionaryReplaceSessionContext = createContext<DictionaryReplaceSessionValue | null>(null)

const IDLE: Omit<
  DictionaryReplaceSessionValue,
  'startByIds' | 'startByFilter' | 'acknowledge' | 'running'
> = {
  status: 'idle',
  phase: null,
  processed: 0,
  total: 0,
  lastUpdated: 0
}

export function DictionaryReplaceSessionProvider({
  children
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const { t } = useAppTranslation(['dictionary', 'toasts', 'common'])
  const [state, setState] = useState(IDLE)
  const runningRef = useRef(false)

  const acknowledge = useCallback(() => {
    setState(IDLE)
  }, [])

  const run = useCallback(
    async (work: () => Promise<{ updated: number }>) => {
      if (runningRef.current) return
      runningRef.current = true

      setState({
        status: 'running',
        phase: 'counting',
        processed: 0,
        total: 0,
        lastUpdated: 0
      })

      const unsub = window.api.dictionary.onReplaceProgress((progress) => {
        setState((previous) => ({
          ...previous,
          phase: progress.phase,
          processed: progress.phase === 'replacing' ? progress.processed : previous.processed,
          total:
            progress.phase === 'counting' || progress.phase === 'replacing'
              ? progress.total
              : previous.total
        }))
      })

      try {
        const result = await work()
        if (result.updated === 0) {
          toast.info(t('dictionary.replaceNone', { ns: 'toasts' }))
        } else {
          toast.success(t('dictionary.replaceApplied', { ns: 'toasts', count: result.updated }))
        }
        setState({
          status: 'done',
          phase: null,
          processed: result.updated,
          total: result.updated,
          lastUpdated: result.updated
        })
      } catch (error) {
        toast.error(getLocalizedErrorMessage(error, t))
        setState({
          status: 'error',
          phase: null,
          processed: 0,
          total: 0,
          lastUpdated: 0
        })
      } finally {
        runningRef.current = false
        unsub()
      }
    },
    [t]
  )

  const startByIds = useCallback(
    async (ids: number[], filters: DictionaryFilters, patch: DictionaryReplacePatch) => {
      if (ids.length === 0) return
      await run(() => window.api.dictionary.replaceByIds(ids, filters, patch))
    },
    [run]
  )

  const startByFilter = useCallback(
    async (filters: DictionaryFilters, patch: DictionaryReplacePatch) => {
      await run(() => window.api.dictionary.replaceByFilter(filters, patch))
    },
    [run]
  )

  const value = useMemo<DictionaryReplaceSessionValue>(
    () => ({
      ...state,
      running: state.status === 'running',
      startByIds,
      startByFilter,
      acknowledge
    }),
    [acknowledge, startByFilter, startByIds, state]
  )

  return (
    <DictionaryReplaceSessionContext.Provider value={value}>
      {children}
    </DictionaryReplaceSessionContext.Provider>
  )
}

export function useDictionaryReplaceSession(): DictionaryReplaceSessionValue {
  const context = useContext(DictionaryReplaceSessionContext)
  if (!context) {
    throw new Error(
      'useDictionaryReplaceSession must be used within DictionaryReplaceSessionProvider'
    )
  }
  return context
}
