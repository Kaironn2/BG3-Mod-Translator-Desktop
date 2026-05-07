import { useState } from 'react'
import { toast } from 'sonner'
import type { PreparedTranslationInput } from '@/types'
import type { TranslationSession } from '../types'

interface UseTranslationImportParams {
  session: TranslationSession
  sourceLang: string
  targetLang: string
  modName: string
}

export function useTranslationImport({
  session,
  sourceLang,
  targetLang,
  modName
}: UseTranslationImportParams) {
  const [isPreparing, setIsPreparing] = useState(false)
  const [preparedImport, setPreparedImport] = useState<PreparedTranslationInput | null>(null)

  const completeImport = async (importId: string, candidateId: string) => {
    const result = await window.api.mod.completeTranslationImport({
      importId,
      candidateId,
      modName,
      targetLang
    })
    await session.loadSession(result.xmlPath, sourceLang, targetLang, modName, {
      storedPath: result.xmlPath
    })
    setPreparedImport(null)
  }

  const openFile = async (filePath: string | null, ready: boolean) => {
    if (!ready || isPreparing || session.phase === 'loading' || !filePath) return

    try {
      setIsPreparing(true)
      const prepared = await window.api.mod.prepareTranslationInput({ inputPath: filePath })
      const validCandidates = prepared.candidates.filter((candidate) => candidate.valid)
      if (prepared.requiresSelection) {
        setPreparedImport(prepared)
        if (validCandidates.length === 0) toast.error('Nenhum XML valido encontrado')
        return
      }

      const candidate = validCandidates[0]
      if (!candidate) {
        await window.api.mod.discardTranslationInput({ importId: prepared.importId })
        toast.error('Formato invalido')
        return
      }

      await completeImport(prepared.importId, candidate.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar arquivo')
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
