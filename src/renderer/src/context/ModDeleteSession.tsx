import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { DeleteModsResult, ModDeleteProgressUpdate } from '@/types'

export type ModDeleteStatus = 'idle' | 'running' | 'done' | 'error'

export interface ModDeleteSessionValue {
  status: ModDeleteStatus
  phase: ModDeleteProgressUpdate['phase'] | null
  processed: number
  total: number
  lastDeletedMods: number
  lastDeletedRows: number
  running: boolean
  start: (modNames: string[]) => Promise<void>
  acknowledge: () => void
}

const ModDeleteSessionContext = createContext<ModDeleteSessionValue | null>(null)

const IDLE: Omit<ModDeleteSessionValue, 'start' | 'acknowledge' | 'running'> = {
  status: 'idle',
  phase: null,
  processed: 0,
  total: 0,
  lastDeletedMods: 0,
  lastDeletedRows: 0
}

export function ModDeleteSessionProvider({
  children
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const { t } = useAppTranslation(['mods', 'toasts'])
  const [state, setState] = useState(IDLE)
  const runningRef = useRef(false)

  const acknowledge = useCallback(() => {
    setState(IDLE)
  }, [])

  const start = useCallback(
    async (modNames: string[]) => {
      const names = [...new Set(modNames.map((name) => name.trim()).filter(Boolean))]
      if (names.length === 0) return
      if (runningRef.current) return
      runningRef.current = true

      setState({
        status: 'running',
        phase: 'counting',
        processed: 0,
        total: 0,
        lastDeletedMods: 0,
        lastDeletedRows: 0
      })

      const unsub = window.api.mod.onDeleteProgress((progress) => {
        setState((previous) => ({
          ...previous,
          phase: progress.phase,
          processed:
            progress.phase === 'deleting'
              ? (progress.processed ?? previous.processed)
              : previous.processed,
          total:
            progress.phase === 'counting' || progress.phase === 'deleting'
              ? (progress.total ?? previous.total)
              : previous.total
        }))
      })

      try {
        const result: DeleteModsResult =
          names.length === 1
            ? await window.api.mod.delete({ modName: names[0] }).then((item) => ({
                dictionaryRows: item.dictionaryRows,
                mods: [item]
              }))
            : await window.api.mod.deleteMany({ modNames: names })

        if (result.mods.length === 1) {
          toast.success(t('toast.deleted', { name: result.mods[0].modName }))
        } else {
          toast.success(
            t('toast.deletedMany', {
              count: result.mods.length,
              rows: result.dictionaryRows
            })
          )
        }

        setState({
          status: 'done',
          phase: null,
          processed: result.dictionaryRows,
          total: result.dictionaryRows,
          lastDeletedMods: result.mods.length,
          lastDeletedRows: result.dictionaryRows
        })
      } catch (error) {
        toast.error(getLocalizedErrorMessage(error, t) || t('toast.deleteFailed'))
        setState({
          status: 'error',
          phase: null,
          processed: 0,
          total: 0,
          lastDeletedMods: 0,
          lastDeletedRows: 0
        })
      } finally {
        runningRef.current = false
        unsub()
      }
    },
    [t]
  )

  const value = useMemo<ModDeleteSessionValue>(
    () => ({
      ...state,
      running: state.status === 'running',
      start,
      acknowledge
    }),
    [acknowledge, start, state]
  )

  return (
    <ModDeleteSessionContext.Provider value={value}>{children}</ModDeleteSessionContext.Provider>
  )
}

export function useModDeleteSession(): ModDeleteSessionValue {
  const context = useContext(ModDeleteSessionContext)
  if (!context) {
    throw new Error('useModDeleteSession must be used within ModDeleteSessionProvider')
  }
  return context
}
