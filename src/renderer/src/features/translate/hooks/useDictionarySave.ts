import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { encodeEntities } from '@/lib/xmlEntities'
import type { TranslationSession } from '../types'

export function useDictionarySave(session: TranslationSession) {
  const [isSaving, setIsSaving] = useState(false)
  const { entries, sourceLang, targetLang, modName } = session

  const saveEntry = useCallback(
    async (rowId: string, target: string) => {
      if (!target.trim()) return
      const entry = entries.find((item) => item.rowId === rowId)
      if (!entry) return
      try {
        await window.api.dictionary.upsert({
          language1: sourceLang,
          language2: targetLang,
          textLanguage1: encodeEntities(entry.source),
          textLanguage2: encodeEntities(target),
          modName: modName || null,
          uid: entry.uid || null
        })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao salvar entrada')
      }
    },
    [entries, modName, sourceLang, targetLang]
  )

  const saveAll = useCallback(async () => {
    const toSave = entries.filter((entry) => entry.target.trim() !== '')
    if (toSave.length === 0) {
      toast.info('Nenhuma traducao para salvar')
      return
    }

    setIsSaving(true)
    try {
      for (const entry of toSave) {
        await window.api.dictionary.upsert({
          language1: sourceLang,
          language2: targetLang,
          textLanguage1: encodeEntities(entry.source),
          textLanguage2: encodeEntities(entry.target),
          modName: modName || null,
          uid: entry.uid || null
        })
      }
      toast.success(`${toSave.length} traducoes salvas no dicionario`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setIsSaving(false)
    }
  }, [entries, modName, sourceLang, targetLang])

  return { isSaving, saveEntry, saveAll }
}
