import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { Language, ModMeta } from '@/types'
import type { ExportFormat, TranslationSession } from '../types'
import { exportFileBaseName, languageToBg3Folder } from '../utils/exportNames'

const EXPORT_FORMAT_ORDER: ExportFormat[] = ['xml', 'pak', 'zip']

export function useTranslationExport(session: TranslationSession, languages: Language[]) {
  const { t } = useAppTranslation(['toasts', 'common'])
  const [isExporting, setIsExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xml')
  const [exportMeta, setExportMeta] = useState<ModMeta | null>(null)
  const [bg3LanguageFolder, setBg3LanguageFolder] = useState('')
  const { entries, modName, targetLang } = session

  const exportXml = useCallback(async () => {
    const outputPath = await window.api.fs.saveDialog({
      defaultName: `${exportFileBaseName(modName || 'translation', targetLang)}.xml`,
      filters: [{ name: 'XML', extensions: ['xml'] }]
    })
    if (!outputPath) return

    try {
      await window.api.xml.export({ outputPath, entries })
      toast.success(t('translate.xmlExported', { ns: 'toasts' }))
    } catch (err) {
      toast.error(getLocalizedErrorMessage(err, t))
    }
  }, [entries, modName, t, targetLang])

  const openExport = useCallback(async () => {
    if (exportFormat === 'xml') {
      await exportXml()
      return
    }

    try {
      const meta = await window.api.mod.getMeta({ modName, targetLang })
      const targetLanguage = languages.find((language) => language.code === targetLang)
      setExportMeta(meta)
      setBg3LanguageFolder(languageToBg3Folder(targetLanguage, targetLang))
    } catch (err) {
      toast.error(getLocalizedErrorMessage(err, t))
    }
  }, [exportFormat, exportXml, languages, modName, t, targetLang])

  const submitPackageExport = useCallback(
    async (meta: ModMeta, languageFolder: string) => {
      const outputPath = await window.api.fs.saveDialog({
        defaultName: `${meta.folder}.${exportFormat}`,
        filters: [{ name: exportFormat.toUpperCase(), extensions: [exportFormat] }]
      })
      if (!outputPath) return

      setIsExporting(true)
      try {
        await window.api.mod.exportTranslatedPackage({
          outputPath,
          format: exportFormat === 'zip' ? 'zip' : 'pak',
          modName,
          entries,
          meta,
          bg3LanguageFolder: languageFolder
        })
        toast.success(
          t('translate.packageExported', {
            ns: 'toasts',
            format: exportFormat.toUpperCase()
          })
        )
        setExportMeta(null)
      } catch (err) {
        toast.error(getLocalizedErrorMessage(err, t))
      } finally {
        setIsExporting(false)
      }
    },
    [entries, exportFormat, modName, t]
  )

  const cycleExportFormat = useCallback(() => {
    setExportFormat((current) => {
      const index = EXPORT_FORMAT_ORDER.indexOf(current)
      return EXPORT_FORMAT_ORDER[(index + 1) % EXPORT_FORMAT_ORDER.length]
    })
  }, [])

  return {
    isExporting,
    exportFormat,
    exportMeta,
    bg3LanguageFolder,
    setExportFormat,
    cycleExportFormat,
    openExport,
    submitPackageExport,
    closeExportModal: () => setExportMeta(null)
  }
}
