import { useState } from 'react'
import { toast } from 'sonner'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { CsvColumnMap, PreparedTranslationInput } from '@/types'
import type { TranslationSession } from '../types'

interface UseTranslationImportParams {
  session: TranslationSession
  sourceLang: string
  targetLang: string
  modName: string
  parserId: string
  columnMap?: CsvColumnMap
}

export function useTranslationImport({
  session,
  sourceLang,
  targetLang,
  modName,
  parserId,
  columnMap
}: UseTranslationImportParams) {
  const { t } = useAppTranslation(['toasts', 'common'])
  const [isPreparing, setIsPreparing] = useState(false)
  const [preparedImport, setPreparedImport] = useState<PreparedTranslationInput | null>(null)

  const completeImport = async (importId: string, candidateIds: string[]) => {
    const result = await window.api.mod.completeTranslationImport({
      importId,
      candidateIds,
      modName,
      targetLang
    })
    await session.loadSession(result.xmlPath, sourceLang, targetLang, modName, {
      storedPath: result.xmlPath,
      parserId
    })
    setPreparedImport(null)
  }

  const openFile = async (filePath: string | null, ready: boolean) => {
    if (!ready || isPreparing || session.phase === 'loading' || !filePath) return

    try {
      setIsPreparing(true)
      if (parserId === 'csv') {
        await session.loadSession(filePath, sourceLang, targetLang, modName, {
          parserId,
          columnMap
        })
        return
      }
      const prepared = await window.api.mod.prepareTranslationInput({ inputPath: filePath })
      const validCandidates = prepared.candidates.filter((candidate) => candidate.valid)
      if (prepared.requiresSelection) {
        setPreparedImport(prepared)
        if (validCandidates.length === 0) {
          toast.error(t('translate.noValidXml', { ns: 'toasts' }))
        }
        return
      }

      const candidate = validCandidates[0]
      if (!candidate) {
        await window.api.mod.discardTranslationInput({ importId: prepared.importId })
        toast.error(t('translate.invalidFormat', { ns: 'toasts' }))
        return
      }

      await completeImport(prepared.importId, [candidate.id])
    } catch (err) {
      toast.error(getLocalizedErrorMessage(err, t))
    } finally {
      setIsPreparing(false)
    }
  }

  const closeImportModal = async () => {
    if (preparedImport) {
      await window.api.mod.discardTranslationInput({ importId: preparedImport.importId })
    }
    setPreparedImport(null)
  }

  return {
    isPreparing,
    preparedImport,
    openFile,
    completeImport,
    closeImportModal
  }
}
