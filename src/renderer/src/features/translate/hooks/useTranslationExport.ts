import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { Language, ModMeta } from '@/types'
import type { ExportFormat, TranslationSession } from '../types'
import { exportFileBaseName, languageToBg3Folder } from '../utils/exportNames'

export function useTranslationExport(session: TranslationSession, languages: Language[]) {
  const { t } = useAppTranslation(['toasts', 'common'])
  const [isExporting, setIsExporting] = useState(false)
  const [exportMeta, setExportMeta] = useState<ModMeta | null>(null)
  const [bg3LanguageFolder, setBg3LanguageFolder] = useState('')
  const { entries, modName, targetLang } = session

  const exportXml = useCallback(
    async (format: ExportFormat) => {
      const useLoca = format === 'loca'
      const targetLanguage = languages.find((language) => language.code === targetLang)
      const folder = languageToBg3Folder(targetLanguage, targetLang)
      const base = exportFileBaseName(modName || 'translation', targetLang)

      // Multiple known source files -> one file per original file in a chosen
      // folder (single-file sessions keep the plain save dialog). For xml the
      // output is always .xml; for explicit loca it is .loca.
      const sourceFileCount = new Set(
        entries
          .map((entry) => entry.sourceFile?.trim().toLowerCase())
          .filter((name): name is string => !!name && /^[^\\/]+\.(xml|loca)$/i.test(name))
      ).size
      if (sourceFileCount > 1) {
        const outputDir = await window.api.fs.openFolder()
        if (!outputDir) return
        setIsExporting(true)
        try {
          const ext = useLoca ? '.loca' : '.xml'
          const written = await window.api.xml.exportPerSourceFile({
            outputDir,
            entries,
            fallbackFileName: `${base}${ext}`,
            fileType: useLoca ? 'loca' : 'xml'
          })
          const key = useLoca ? 'translate.locaFilesExported' : 'translate.xmlFilesExported'
          toast.success(t(key, { ns: 'toasts', count: written.length }))
        } catch (err) {
          toast.error(getLocalizedErrorMessage(err, t))
        } finally {
          setIsExporting(false)
        }
        return
      }

      const outputPath = await window.api.fs.saveDialog({
        defaultName: useLoca ? `${folder.toLowerCase()}.loca` : `${base}.xml`,
        filters: [{ name: useLoca ? 'LOCA' : 'XML', extensions: [useLoca ? 'loca' : 'xml'] }]
      })
      if (!outputPath) return

      setIsExporting(true)
      try {
        await window.api.xml.export({
          outputPath,
          entries,
          fileType: useLoca ? 'loca' : 'xml'
        })
        toast.success(
          t(useLoca ? 'translate.locaExported' : 'translate.xmlExported', { ns: 'toasts' })
        )
      } catch (err) {
        toast.error(getLocalizedErrorMessage(err, t))
      } finally {
        setIsExporting(false)
      }
    },
    [entries, languages, modName, t, targetLang]
  )

  const openExport = useCallback(async () => {
    try {
      const meta = await window.api.mod.getMeta({ modName, targetLang })
      const targetLanguage = languages.find((language) => language.code === targetLang)
      setExportMeta(meta)
      setBg3LanguageFolder(languageToBg3Folder(targetLanguage, targetLang))
    } catch (err) {
      toast.error(getLocalizedErrorMessage(err, t))
    }
  }, [languages, modName, t, targetLang])

  const closeExportModal = useCallback(() => setExportMeta(null), [])

  const submitExport = useCallback(
    async (format: ExportFormat, meta: ModMeta, languageFolder: string) => {
      if (format === 'xml' || format === 'loca') {
        closeExportModal()
        await exportXml(format)
        return
      }

      const outputPath = await window.api.fs.saveDialog({
        defaultName: `${meta.folder}.${format}`,
        filters: [{ name: format.toUpperCase(), extensions: [format] }]
      })
      if (!outputPath) return

      setIsExporting(true)
      try {
        await window.api.mod.exportTranslatedPackage({
          outputPath,
          format: format === 'zip' ? 'zip' : 'pak',
          modName,
          entries,
          meta,
          bg3LanguageFolder: languageFolder,
          preserveSourceFiles: true
        })
        toast.success(
          t('translate.packageExported', { ns: 'toasts', format: format.toUpperCase() })
        )
        closeExportModal()
      } catch (err) {
        toast.error(getLocalizedErrorMessage(err, t))
      } finally {
        setIsExporting(false)
      }
    },
    [closeExportModal, entries, exportXml, modName, t]
  )

  return {
    isExporting,
    exportMeta,
    bg3LanguageFolder,
    openExport,
    submitExport,
    closeExportModal
  }
}
