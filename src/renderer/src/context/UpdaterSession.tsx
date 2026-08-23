import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { UpdaterState } from '@/types'

const EMPTY_STATE: UpdaterState = {
  currentVersion: '',
  channel: 'unsupported',
  status: 'idle',
  latestVersion: null,
  releaseUrl: null,
  lastCheckedAt: null,
  downloadPercent: 0,
  downloadedBytes: 0,
  totalBytes: 0,
  backupPercent: 0,
  errorCode: null,
  changelog: null
}

interface UpdaterSessionValue {
  state: UpdaterState
  check: () => Promise<void>
  install: () => Promise<void>
  ackChangelog: () => Promise<void>
}

const UpdaterSessionContext = createContext<UpdaterSessionValue | null>(null)

export function UpdaterProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [state, setState] = useState<UpdaterState>(EMPTY_STATE)

  useEffect(() => {
    void window.api.updater.getState().then(setState)
    return window.api.updater.onState(setState)
  }, [])

  const check = useCallback(async () => {
    const next = await window.api.updater.check()
    setState(next)
  }, [])

  const install = useCallback(async () => {
    await window.api.updater.install()
  }, [])

  const ackChangelog = useCallback(async () => {
    const next = await window.api.updater.ackChangelog()
    setState(next)
  }, [])

  const value = useMemo(
    () => ({ state, check, install, ackChangelog }),
    [state, check, install, ackChangelog]
  )

  return <UpdaterSessionContext.Provider value={value}>{children}</UpdaterSessionContext.Provider>
}

export function useUpdater(): UpdaterSessionValue {
  const context = useContext(UpdaterSessionContext)
  if (!context) {
    throw new Error('useUpdater must be used within UpdaterProvider')
  }
  return context
}
