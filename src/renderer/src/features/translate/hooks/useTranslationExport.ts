import { exportFormatsFor, GENERIC_EXPORT_FORMATS, getParser } from '@shared/parsers/catalog'
import type { ExportFormat } from '@shared/parsers/types'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { Language, ModMeta } from '@/types'
import type { TranslationSession } from '../types'
import { exportFileBaseName, languageToBg3Folder } from '../utils/exportNames'

export function useTranslationExport(session: TranslationSession, languages: Language[]) {
  const { t } = useAppTranslation(['toasts', 'common'])
  const [isExporting, setIsExporting] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportMeta, setExportMeta] = useState<ModMeta | null>(null)
  const [bg3LanguageFolder, setBg3LanguageFolder] = useState('')
  const { entries, modName, parserId, targetLang } = session
  const parser = parserId ? getParser(parserId) : undefined
  const formats = useMemo(
    () => (parser ? exportFormatsFor(parser) : [...GENERIC_EXPORT_FORMATS]),
    [parser]
  )

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
      if (formats.some((format) => format === 'pak' || format === 'zip' || format === 'xml')) {
        const meta = await window.api.mod.getMeta({ modName, targetLang })
        const targetLanguage = languages.find((language) => language.code === targetLang)
        setExportMeta(meta)
        setBg3LanguageFolder(languageToBg3Folder(targetLanguage, targetLang))
      } else {
        setExportMeta(null)
      }
      setExportOpen(true)
    } catch (err) {
      toast.error(getLocalizedErrorMessage(err, t))
    }
  }, [formats, languages, modName, t, targetLang])

  const closeExportModal = useCallback(() => {
    setExportOpen(false)
    setExportMeta(null)
  }, [])

  const submitExport = useCallback(
    async (format: ExportFormat, meta: ModMeta | null, languageFolder: string) => {
      if (!formats.includes(format)) {
        toast.error(t('translate.invalidFormat', { ns: 'toasts' }))
        return
      }
      if (format === 'xml' || format === 'loca') {
        closeExportModal()
        await exportXml(format)
        return
      }

      if (format === 'csv' || format === 'json') {
        const base = exportFileBaseName(modName || 'translation', targetLang)
        const outputPath = await window.api.fs.saveDialog({
          defaultName: `${base}.${format}`,
          filters: [{ name: format.toUpperCase(), extensions: [format] }]
        })
        if (!outputPath) return
        setIsExporting(true)
        try {
          await window.api.parser.exportProject({
            parserId: parserId || 'csv',
            format,
            outputPath,
            entries
          })
          toast.success(
            t(format === 'json' ? 'translate.jsonExported' : 'translate.csvExported', {
              ns: 'toasts'
            })
          )
          closeExportModal()
        } catch (err) {
          toast.error(getLocalizedErrorMessage(err, t))
        } finally {
          setIsExporting(false)
        }
        return
      }

      if (!meta) return
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
    [closeExportModal, entries, exportXml, formats, modName, parserId, t, targetLang]
  )

  return {
    isExporting,
    exportOpen,
    exportMeta,
    formats,
    bg3LanguageFolder,
    openExport,
    submitExport,
    closeExportModal
  }
}
