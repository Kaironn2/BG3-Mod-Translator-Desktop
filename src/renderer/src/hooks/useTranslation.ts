import { useState, useEffect, useRef, useCallback } from 'react'
import type { TranslationProgressEvent } from '@/types'

export interface TranslationRow {
  index: number
  source: string
  target: string
}

type JobStatus = 'idle' | 'running' | 'done' | 'error' | 'cancelled'

interface TranslationState {
  status: JobStatus
  jobId: string | null
  rows: TranslationRow[]
  current: number
  total: number
  outputPath: string | null
  error: string | null
}

interface StartOptions {
  provider: 'openai' | 'deepl' | 'manual'
  filePath: string
  modName: string
  sourceLang: string
  targetLang: string
  apiKey?: string
  author?: string
  model?: string
}

const INITIAL: TranslationState = {
  status: 'idle',
  jobId: null,
  rows: [],
  current: 0,
  total: 0,
  outputPath: null,
  error: null
}

export function useTranslation() {
  const [state, setState] = useState<TranslationState>(INITIAL)
  const unsubscribers = useRef<(() => void)[]>([])

  // Clean up event listeners when component unmounts or job ends
  const clearListeners = useCallback(() => {
    unsubscribers.current.forEach((fn) => fn())
    unsubscribers.current = []
  }, [])

  useEffect(() => () => clearListeners(), [clearListeners])

  const start = useCallback(
    async (opts: StartOptions) => {
      clearListeners()
      setState({ ...INITIAL, status: 'running' })

      const { jobId } = await window.api.translation.start(opts)
      setState((s) => ({ ...s, jobId }))

      const offProgress = window.api.translation.onProgress((ev: TranslationProgressEvent) => {
        if (ev.jobId !== jobId) return
        setState((s) => ({
          ...s,
          current: ev.current,
          total: ev.total,
          rows: [...s.rows, { index: ev.current, source: ev.source, target: ev.target }]
        }))
      })

      const offDone = window.api.translation.onDone((ev) => {
        if (ev.jobId !== jobId) return
        setState((s) => ({ ...s, status: 'done', outputPath: ev.outputPath }))
        clearListeners()
      })

      const offError = window.api.translation.onError((ev) => {
        if (ev.jobId !== jobId) return
        setState((s) => ({ ...s, status: 'error', error: ev.message }))
        clearListeners()
      })

      unsubscribers.current = [offProgress, offDone, offError]
    },
    [clearListeners]
  )

  const cancel = useCallback(async () => {
    if (!state.jobId) return
    await window.api.translation.cancel(state.jobId)
    clearListeners()
    setState((s) => ({ ...s, status: 'cancelled' }))
  }, [state.jobId, clearListeners])

  const reset = useCallback(() => {
    clearListeners()
    setState(INITIAL)
  }, [clearListeners])

  return { ...state, start, cancel, reset }
}
