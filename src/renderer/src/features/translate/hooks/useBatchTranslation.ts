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

      setIsBatchTranslating(true)
      batchUnsubRef.current?.()
      batchUnsubRef.current = window.api.translation.onBatchProgress(({ uid, target, error }) => {
        if (error) {
          if (uid) toast.error(`Erro em #${uid.slice(0, 8)}: ${error}`)
          else toast.error(error)
          return
        }
        if (target) updateEntry(uid, target)
      })

      try {
        await window.api.translation.batch({
          entries: selectedEntries,
          provider,
          sourceLang,
          targetLang
        })
        toast.success(`${selectedEntries.length} entradas traduzidas`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro na traducao em lote')
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
