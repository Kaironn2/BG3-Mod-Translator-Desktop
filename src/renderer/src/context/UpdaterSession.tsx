import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
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
  // True only while a check started from this renderer is running. Background
  // (startup/scheduled) checks must not disable the manual button.
  checking: boolean
  check: () => Promise<void>
  install: () => Promise<void>
  ackChangelog: () => Promise<void>
}

const UpdaterSessionContext = createContext<UpdaterSessionValue | null>(null)

export function UpdaterProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [state, setState] = useState<UpdaterState>(EMPTY_STATE)
  const [checking, setChecking] = useState(false)
  // Ref mirrors `checking` so the push listener can read the current value
  // without re-subscribing on every toggle.
  const checkingRef = useRef(false)

  useEffect(() => {
    void window.api.updater.getState().then(setState)
    return window.api.updater.onState((next) => {
      setState(next)
      if (next.status !== 'checking' && checkingRef.current) {
        // A check started here has settled (up-to-date / available / error /
        // downloading). Re-enable the manual button immediately.
        checkingRef.current = false
        setChecking(false)
      }
    })
  }, [])

  const check = useCallback(async () => {
    if (checkingRef.current) return
    checkingRef.current = true
    setChecking(true)
    try {
      const next = await window.api.updater.check()
      setState(next)
    } finally {
      checkingRef.current = false
      setChecking(false)
    }
  }, [])

  const install = useCallback(async () => {
    await window.api.updater.install()
  }, [])

  const ackChangelog = useCallback(async () => {
    const next = await window.api.updater.ackChangelog()
    setState(next)
  }, [])

  const value = useMemo(
    () => ({ state, checking, check, install, ackChangelog }),
    [state, checking, check, install, ackChangelog]
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
