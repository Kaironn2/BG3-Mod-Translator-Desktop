import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { DictionaryDeleteProgressUpdate, DictionaryFilters } from '@/types'

export type DictionaryDeleteStatus = 'idle' | 'running' | 'done' | 'error'

export interface DictionaryDeleteSessionValue {
  status: DictionaryDeleteStatus
  phase: DictionaryDeleteProgressUpdate['phase'] | null
  processed: number
  total: number
  lastDeleted: number
  running: boolean
  startByIds: (ids: number[]) => Promise<void>
  startByFilter: (filters: DictionaryFilters) => Promise<void>
  acknowledge: () => void
}

const DictionaryDeleteSessionContext = createContext<DictionaryDeleteSessionValue | null>(null)

const IDLE: Omit<
  DictionaryDeleteSessionValue,
  'startByIds' | 'startByFilter' | 'acknowledge' | 'running'
> = {
  status: 'idle',
  phase: null,
  processed: 0,
  total: 0,
  lastDeleted: 0
}

export function DictionaryDeleteSessionProvider({
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
    async (work: () => Promise<{ deleted: number }>) => {
      if (runningRef.current) return
      runningRef.current = true

      setState({
        status: 'running',
        phase: 'counting',
        processed: 0,
        total: 0,
        lastDeleted: 0
      })

      const unsub = window.api.dictionary.onDeleteProgress((progress) => {
        setState((previous) => ({
          ...previous,
          phase: progress.phase,
          processed: progress.phase === 'deleting' ? progress.processed : previous.processed,
          total:
            progress.phase === 'counting' || progress.phase === 'deleting'
              ? progress.total
              : previous.total
        }))
      })

      try {
        const result = await work()
        toast.success(
          t(result.deleted === 1 ? 'dictionary.deleted_one' : 'dictionary.deleted_other', {
            ns: 'toasts',
            count: result.deleted
          })
        )
        setState({
          status: 'done',
          phase: null,
          processed: result.deleted,
          total: result.deleted,
          lastDeleted: result.deleted
        })
      } catch (error) {
        toast.error(getLocalizedErrorMessage(error, t))
        setState({
          status: 'error',
          phase: null,
          processed: 0,
          total: 0,
          lastDeleted: 0
        })
      } finally {
        runningRef.current = false
        unsub()
      }
    },
    [t]
  )

  const startByIds = useCallback(
    async (ids: number[]) => {
      if (ids.length === 0) return
      await run(() => window.api.dictionary.deleteMany({ ids }))
    },
    [run]
  )

  const startByFilter = useCallback(
    async (filters: DictionaryFilters) => {
      await run(() => window.api.dictionary.deleteByFilter(filters))
    },
    [run]
  )

  const value = useMemo<DictionaryDeleteSessionValue>(
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
    <DictionaryDeleteSessionContext.Provider value={value}>
      {children}
    </DictionaryDeleteSessionContext.Provider>
  )
}

export function useDictionaryDeleteSession(): DictionaryDeleteSessionValue {
  const context = useContext(DictionaryDeleteSessionContext)
  if (!context) {
    throw new Error(
      'useDictionaryDeleteSession must be used within DictionaryDeleteSessionProvider'
    )
  }
  return context
}
