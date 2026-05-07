import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type {
  TranslationBatchDoneEvent,
  TranslationBatchErrorEvent,
  TranslationBatchProgressEvent
} from '@/types'
import type { TranslationSession } from '../types'

export function useBatchTranslation(session: TranslationSession) {
  const [isBatchTranslating, setIsBatchTranslating] = useState(false)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const batchCleanupRef = useRef<(() => void) | null>(null)
  const activeJobIdRef = useRef<string | null>(null)
  const pendingUidsRef = useRef<Set<string>>(new Set())
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
      setActiveJobId(null)
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
        toast.info('Nenhuma entrada selecionada')
        return
      }

      pendingUidsRef.current = new Set(selectedEntries.map((entry) => entry.uid))
      setIsBatchTranslating(true)
      clearListeners()

      const handleBatchProgress = ({ jobId, uid, target }: TranslationBatchProgressEvent) => {
        if (jobId !== activeJobIdRef.current) return
        if (target === null) return
        pendingUidsRef.current.delete(uid)
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
          toast.info(`${translated} de ${total} entradas traduzidas antes do cancelamento`)
        } else if (failed > 0) {
          restorePendingSelection()
          toast.warning(
            `${translated} de ${total} entradas traduzidas; ${failed} permanecem pendentes`
          )
        } else {
          clearSelection()
          toast.success(`${translated} entradas traduzidas`)
        }

        finishBatchJob(jobId)
      }

      const handleBatchError = ({ jobId, message }: TranslationBatchErrorEvent) => {
        if (jobId !== activeJobIdRef.current) return

        restorePendingSelection()
        toast.error(message)
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
        const message = err instanceof Error ? err.message : 'Erro na traducao em lote'
        clearListeners()
        activeJobIdRef.current = null
        setActiveJobId(null)
        setIsBatchTranslating(false)
        toast.error(message)
        void window.api.log.write({
          scope: 'renderer.batchTranslation',
          message,
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

  return { isBatchTranslating, batchTranslate, cancelBatch, activeJobId }
}
