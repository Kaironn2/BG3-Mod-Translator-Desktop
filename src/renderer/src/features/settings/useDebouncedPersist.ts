import { type MutableRefObject, useEffect, useRef } from 'react'

const DEFAULT_MS = 600

export function useDebouncedPersist(
  persist: (value: string) => void,
  delayMs = DEFAULT_MS
): {
  onInput: (value: string) => void
  flush: (value: string) => void
  lastSavedRef: MutableRefObject<string>
} {
  const timerRef = useRef<number | null>(null)
  const lastSavedRef = useRef('')
  const persistRef = useRef(persist)
  persistRef.current = persist

  const commit = (value: string): void => {
    const trimmed = value.trim()
    if (trimmed === lastSavedRef.current) return
    lastSavedRef.current = trimmed
    persistRef.current(trimmed)
  }

  const onInput = (value: string): void => {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      commit(value)
    }, delayMs)
  }

  const flush = (value: string): void => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    commit(value)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [])

  return { onInput, flush, lastSavedRef }
}
