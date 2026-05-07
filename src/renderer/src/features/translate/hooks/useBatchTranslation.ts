import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { TranslationSession } from '../types'

export function useBatchTranslation(session: TranslationSession) {
  const [isBatchTranslating, setIsBatchTranslating] = useState(false)
  const batchUnsubRef = useRef<(() => void) | null>(null)
  const { entries, selectedUids, sourceLang, targetLang, updateEntry, clearSelection } = session

  useEffect(() => {
    return () => {
      batchUnsubRef.current?.()
      batchUnsubRef.current = null
    }
  }, [])

  const batchTranslate = useCallback(
    async (provider: 'openai' | 'deepl') => {
      const selectedEntries = entries
        .filter((entry) => selectedUids.has(entry.rowId))
        .map((entry) => ({ uid: entry.rowId, source: entry.source }))

      if (selectedEntries.length === 0) {
        toast.info('Nenhuma entrada selecionada')
        return
      }

      setIsBatchTranslating(true)
      batchUnsubRef.current?.()
      batchUnsubRef.current = window.api.translation.onBatchProgress(({ uid, target, error }) => {
        if (error) {
          if (uid) toast.error(`Erro em #${uid.slice(0, 8)}: ${error}`)
          else toast.error(error)
          return
        }
        if (target !== null) updateEntry(uid, target)
      })

      try {
        const summary = await window.api.translation.batch({
          entries: selectedEntries,
          provider,
          sourceLang,
          targetLang
        })
        if (summary.failed > 0) {
          toast.warning(
            `${summary.translated} de ${summary.total} entradas traduzidas; ${summary.failed} falharam`
          )
        } else {
          toast.success(`${summary.translated} entradas traduzidas`)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro na traducao em lote'
        toast.error(message)
        void window.api.log.write({
          scope: 'renderer.batchTranslation',
          message,
          stack: err instanceof Error ? err.stack : undefined,
          meta: { provider, sourceLang, targetLang, total: selectedEntries.length }
        })
      } finally {
        batchUnsubRef.current?.()
        batchUnsubRef.current = null
        setIsBatchTranslating(false)
        clearSelection()
      }
    },
    [clearSelection, entries, selectedUids, sourceLang, targetLang, updateEntry]
  )

  return { isBatchTranslating, batchTranslate }
}
