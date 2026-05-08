import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { encodeEntities } from '@/lib/xmlEntities'
import type { TranslationSession } from '../types'

export function useDictionarySave(session: TranslationSession) {
  const { t } = useAppTranslation(['toasts', 'common'])
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
        toast.error(getLocalizedErrorMessage(err, t))
      }
    },
    [entries, modName, sourceLang, targetLang]
  )

  const saveAll = useCallback(async () => {
    const toSave = entries.filter((entry) => entry.target.trim() !== '')
    if (toSave.length === 0) {
      toast.info(t('translate.nothingToSave', { ns: 'toasts' }))
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
      toast.success(t('translate.savedCount', { ns: 'toasts', count: toSave.length }))
    } catch (err) {
      toast.error(getLocalizedErrorMessage(err, t))
    } finally {
      setIsSaving(false)
    }
  }, [entries, modName, sourceLang, targetLang])

  return { isSaving, saveEntry, saveAll }
}
