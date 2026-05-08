import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type {
  TranslationBatchDoneEvent,
  TranslationBatchErrorEvent,
  TranslationBatchProgressEvent
} from '@/types'
import type { TranslationSession } from '../types'

export function useBatchTranslation(session: TranslationSession) {
  const { t } = useAppTranslation(['translate', 'toasts', 'common', 'errors'])
  const [isBatchTranslating, setIsBatchTranslating] = useState(false)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [batchCompleted, setBatchCompleted] = useState(0)
  const [batchTotal, setBatchTotal] = useState(0)
  const batchCleanupRef = useRef<(() => void) | null>(null)
  const activeJobIdRef = useRef<string | null>(null)
  const pendingUidsRef = useRef<Set<string>>(new Set())
  const batchErrorsRef = useRef<Map<string, string>>(new Map())
  const { entries, selectedUids, sourceLang, targetLang, updateEntry, clearSelection, selectEntries } =
    session

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

  const batchTranslate = useCallback(
    async (provider: 'openai' | 'deepl') => {
      if (isBatchTranslating) return

      const selectedEntries = entries
        .filter((entry) => selectedUids.has(entry.rowId))
        .map((entry) => ({ uid: entry.rowId, source: entry.source }))

      if (selectedEntries.length === 0) {
        toast.info(t('batchBar.noSelection', { ns: 'translate' }))
        return
      }

      pendingUidsRef.current = new Set(selectedEntries.map((entry) => entry.uid))
      batchErrorsRef.current = new Map()
      setBatchCompleted(0)
      setBatchTotal(selectedEntries.length)
      setIsBatchTranslating(true)
      clearListeners()
      const selectedEntriesByUid = new Map(selectedEntries.map((entry) => [entry.uid, entry]))

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
          meta: { provider, sourceLang, targetLang, total: selectedEntries.length }
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
          entries: selectedEntries,
          provider,
          sourceLang,
          targetLang
        })
        activeJobIdRef.current = jobId
        setActiveJobId(jobId)
      } catch (err) {
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
          message: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
          meta: { provider, sourceLang, targetLang, total: selectedEntries.length }
        })
      }
    },
    [
      clearListeners,
      clearSelection,
      entries,
      finishBatchJob,
      isBatchTranslating,
      restorePendingSelection,
      selectedUids,
      sourceLang,
      targetLang,
      updateEntry
    ]
  )

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
    activeJobId
  }
}
