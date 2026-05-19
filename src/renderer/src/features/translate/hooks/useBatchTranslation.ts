import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { materializeSelectedEntries } from '@/context/TranslationSession'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type {
  TranslationBatchDoneEvent,
  TranslationBatchErrorEvent,
  TranslationBatchProgressEvent
} from '@/types'
import type { TranslationSession } from '../types'

type BatchEntry = { uid: string; source: string }

export interface QuotaExceededState {
  service: string
  remaining: number
  requested: number
  allowedEntries: number
  totalEntries: number
  renewalAt: string
  allowedEntriesList: BatchEntry[]
  provider: 'deepl' | 'google'
}

export function useBatchTranslation(session: TranslationSession) {
  const { t } = useAppTranslation(['translate', 'toasts', 'common', 'errors'])
  const [isBatchTranslating, setIsBatchTranslating] = useState(false)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [batchCompleted, setBatchCompleted] = useState(0)
  const [batchTotal, setBatchTotal] = useState(0)
  const [pendingDecision, setPendingDecision] = useState(false)
  const [pendingTranslatedCount, setPendingTranslatedCount] = useState(0)
  const [pendingUntranslatedCount, setPendingUntranslatedCount] = useState(0)
  const [quotaExceeded, setQuotaExceeded] = useState<QuotaExceededState | null>(null)
  const batchCleanupRef = useRef<(() => void) | null>(null)
  const activeJobIdRef = useRef<string | null>(null)
  const pendingUidsRef = useRef<Set<string>>(new Set())
  const batchErrorsRef = useRef<Map<string, string>>(new Map())
  const pendingAllEntriesRef = useRef<BatchEntry[]>([])
  const pendingUntranslatedEntriesRef = useRef<BatchEntry[]>([])
  const pendingProviderRef = useRef<'openai' | 'deepl' | 'google'>('deepl')
  const { sourceLang, targetLang, updateEntry, clearSelection, selectEntries } = session

  const clearListeners = useCallback(() => {
    batchCleanupRef.current?.()
    batchCleanupRef.current = null
  }, [])

  const restorePendingSelection = useCallback(() => {
    const pendingUids = Array.from(pendingUidsRef.current)
    clearSelection()
    if (pendingUids.length > 0) {
      selectEntries(pendingUids, true)
    }
  }, [clearSelection, selectEntries])

  const finishBatchJob = useCallback(
    (jobId: string) => {
      if (activeJobIdRef.current !== jobId) return

      clearListeners()
      activeJobIdRef.current = null
      pendingUidsRef.current = new Set()
      batchErrorsRef.current = new Map()
      setActiveJobId(null)
      setBatchCompleted(0)
      setBatchTotal(0)
      setIsBatchTranslating(false)
    },
    [clearListeners]
  )

  useEffect(() => {
    return () => clearListeners()
  }, [clearListeners])

  const dispatchBatchEntries = useCallback(
    async (entriesToSend: BatchEntry[], provider: 'openai' | 'deepl' | 'google') => {
      pendingUidsRef.current = new Set(entriesToSend.map((e) => e.uid))
      batchErrorsRef.current = new Map()
      setBatchCompleted(0)
      setBatchTotal(entriesToSend.length)
      setIsBatchTranslating(true)
      clearListeners()
      const selectedEntriesByUid = new Map(entriesToSend.map((e) => [e.uid, e]))

      const handleBatchProgress = ({
        jobId,
        uid,
        target,
        error,
        completed,
        total
      }: TranslationBatchProgressEvent) => {
        if (jobId !== activeJobIdRef.current) return
        setBatchCompleted(completed)
        setBatchTotal(total)
        if (target === null) {
          batchErrorsRef.current.set(uid, error ?? t('common.unknown', { ns: 'errors' }))
          return
        }
        pendingUidsRef.current.delete(uid)
        batchErrorsRef.current.delete(uid)
        updateEntry(uid, target)
      }

      const handleBatchDone = ({
        jobId,
        total,
        translated,
        failed,
        cancelled
      }: TranslationBatchDoneEvent) => {
        if (jobId !== activeJobIdRef.current) return

        if (cancelled) {
          restorePendingSelection()
          toast.info(t('batchBar.cancelled', { ns: 'translate', translated, total }))
        } else if (failed > 0) {
          restorePendingSelection()
          const firstError = batchErrorsRef.current.values().next().value
          void window.api.log.write({
            scope: 'renderer.batchTranslation.entries',
            message: `${failed} entries failed during batch translation`,
            meta: {
              provider,
              sourceLang,
              targetLang,
              total,
              translated,
              failed,
              entries: Array.from(batchErrorsRef.current.entries()).map(([uid, error]) => ({
                uid,
                error,
                source: selectedEntriesByUid.get(uid)?.source
              }))
            }
          })
          toast.warning(
            firstError
              ? t('batchBar.partialWithError', {
                  ns: 'translate',
                  translated,
                  total,
                  failed,
                  error: firstError
                })
              : t('batchBar.partial', {
                  ns: 'translate',
                  translated,
                  total,
                  failed
                })
          )
        } else {
          clearSelection()
          toast.success(t('batchBar.completed', { ns: 'translate', count: translated }))
        }

        finishBatchJob(jobId)
      }

      const handleBatchError = ({ jobId, message }: TranslationBatchErrorEvent) => {
        if (jobId !== activeJobIdRef.current) return

        restorePendingSelection()
        toast.error(getLocalizedErrorMessage(new Error(message), t))
        void window.api.log.write({
          scope: 'renderer.batchTranslation',
          message,
          meta: { provider, sourceLang, targetLang, total: entriesToSend.length }
        })
        finishBatchJob(jobId)
      }

      const offProgress = window.api.translation.onBatchProgress(handleBatchProgress)
      const offDone = window.api.translation.onBatchDone(handleBatchDone)
      const offError = window.api.translation.onBatchError(handleBatchError)
      batchCleanupRef.current = () => {
        offProgress()
        offDone()
        offError()
      }

      try {
        const { jobId } = await window.api.translation.batch({
          entries: entriesToSend,
          provider,
          sourceLang,
          targetLang
        })
        activeJobIdRef.current = jobId
        setActiveJobId(jobId)
      } catch (err) {
        // check for server-side QUOTA_EXCEEDED backstop
        const rawMessage = err instanceof Error ? err.message : String(err)
        if (rawMessage.startsWith('{')) {
          try {
            const parsed = JSON.parse(rawMessage) as {
              code?: string
              service?: string
              remaining?: number
              requested?: number
              renewalAt?: string
            }
            if (parsed.code === 'QUOTA_EXCEEDED') {
              clearListeners()
              activeJobIdRef.current = null
              setActiveJobId(null)
              setBatchCompleted(0)
              setBatchTotal(0)
              setIsBatchTranslating(false)
              setQuotaExceeded({
                service: parsed.service ?? provider,
                remaining: parsed.remaining ?? 0,
                requested: parsed.requested ?? 0,
                allowedEntries: 0,
                totalEntries: 0,
                renewalAt: parsed.renewalAt ?? '',
                allowedEntriesList: [],
                provider: provider === 'google' ? 'google' : 'deepl'
              })
              return
            }
          } catch {
            // not JSON - fall through to default error handling
          }
        }

        const message = getLocalizedErrorMessage(err, t)
        clearListeners()
        activeJobIdRef.current = null
        setActiveJobId(null)
        setBatchCompleted(0)
        setBatchTotal(0)
        setIsBatchTranslating(false)
        toast.error(message)
        void window.api.log.write({
          scope: 'renderer.batchTranslation',
          message: rawMessage,
          stack: err instanceof Error ? err.stack : undefined,
          meta: { provider, sourceLang, targetLang, total: entriesToSend.length }
        })
      }
    },
    [
      clearListeners,
      clearSelection,
      finishBatchJob,
      restorePendingSelection,
      sourceLang,
      targetLang,
      updateEntry
    ]
  )

  const checkQuotaAndDispatch = useCallback(
    async (entriesToSend: BatchEntry[], provider: 'openai' | 'deepl' | 'google') => {
      if (provider === 'deepl' || provider === 'google') {
        try {
          const usage = await window.api.metrics.getUsage({ service: provider })
          const remaining = usage.charLimit - usage.consumedChars
          const requestedChars = entriesToSend.reduce((sum, e) => sum + e.source.length, 0)

          if (requestedChars > remaining) {
            // collect all entries that fit within the remaining quota (greedy, preserves order)
            let accumulated = 0
            const allowedEntriesList: BatchEntry[] = []
            for (const entry of entriesToSend) {
              if (accumulated + entry.source.length <= remaining) {
                accumulated += entry.source.length
                allowedEntriesList.push(entry)
              }
            }

            setQuotaExceeded({
              service: provider === 'deepl' ? 'DeepL' : 'Google',
              remaining,
              requested: requestedChars,
              allowedEntries: allowedEntriesList.length,
              totalEntries: entriesToSend.length,
              renewalAt: usage.renewalAt,
              allowedEntriesList,
              provider
            })
            return
          }
        } catch {
          // if quota check fails, proceed anyway - server will enforce
        }
      }

      await dispatchBatchEntries(entriesToSend, provider)
    },
    [dispatchBatchEntries]
  )

  const dismissQuotaExceeded = useCallback(() => {
    setQuotaExceeded(null)
  }, [])

  const confirmPartialBatch = useCallback(async () => {
    if (!quotaExceeded) return
    const { allowedEntriesList, provider } = quotaExceeded
    setQuotaExceeded(null)
    await dispatchBatchEntries(allowedEntriesList, provider)
  }, [quotaExceeded, dispatchBatchEntries])

  const clearPending = useCallback(() => {
    setPendingDecision(false)
    setPendingTranslatedCount(0)
    setPendingUntranslatedCount(0)
    pendingAllEntriesRef.current = []
    pendingUntranslatedEntriesRef.current = []
  }, [])

  const batchTranslate = useCallback(
    async (provider: 'openai' | 'deepl' | 'google') => {
      if (isBatchTranslating) return

      const materialized = materializeSelectedEntries(session)
      const toEntry = (e: (typeof materialized)[number]): BatchEntry => ({
        uid: e.rowId,
        source: e.source
      })

      if (materialized.length === 0) {
        toast.info(t('batchBar.noSelection', { ns: 'translate' }))
        return
      }

      const translated = materialized.filter((e) => e.target.trim() !== '')
      const untranslated = materialized.filter((e) => e.target.trim() === '')

      if (translated.length === 0) {
        await checkQuotaAndDispatch(materialized.map(toEntry), provider)
        return
      }

      // some entries already translated - gate with warning dialog
      pendingAllEntriesRef.current = materialized.map(toEntry)
      pendingUntranslatedEntriesRef.current = untranslated.map(toEntry)
      pendingProviderRef.current = provider
      setPendingTranslatedCount(translated.length)
      setPendingUntranslatedCount(untranslated.length)
      setPendingDecision(true)
    },
    [isBatchTranslating, session, checkQuotaAndDispatch]
  )

  const confirmProceedAll = useCallback(async () => {
    const entriesToSend = pendingAllEntriesRef.current
    const provider = pendingProviderRef.current
    clearPending()
    await checkQuotaAndDispatch(entriesToSend, provider)
  }, [clearPending, checkQuotaAndDispatch])

  const confirmSendOnlyUntranslated = useCallback(async () => {
    const entriesToSend = pendingUntranslatedEntriesRef.current
    const provider = pendingProviderRef.current
    clearPending()
    if (entriesToSend.length === 0) {
      toast.info(t('batchBar.noSelection', { ns: 'translate' }))
      return
    }
    await checkQuotaAndDispatch(entriesToSend, provider)
  }, [clearPending, checkQuotaAndDispatch])

  const cancelPending = useCallback(() => {
    clearPending()
  }, [clearPending])

  const cancelBatch = useCallback(async () => {
    if (!activeJobId) return
    await window.api.translation.cancel(activeJobId)
  }, [activeJobId])

  return {
    isBatchTranslating,
    batchCompleted,
    batchTotal,
    batchTranslate,
    cancelBatch,
    activeJobId,
    pendingDecision,
    pendingTranslatedCount,
    pendingUntranslatedCount,
    confirmProceedAll,
    confirmSendOnlyUntranslated,
    cancelPending,
    quotaExceeded,
    dismissQuotaExceeded,
    confirmPartialBatch
  }
}
