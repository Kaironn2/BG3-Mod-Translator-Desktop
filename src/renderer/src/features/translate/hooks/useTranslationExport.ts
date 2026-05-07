import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import type { Language, ModMeta } from '@/types'
import type { ExportFormat, TranslationSession } from '../types'
import { exportFileBaseName, languageToBg3Folder } from '../utils/exportNames'

export function useTranslationExport(session: TranslationSession, languages: Language[]) {
  const [isExporting, setIsExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('xml')
  const [exportMeta, setExportMeta] = useState<ModMeta | null>(null)
  const [bg3LanguageFolder, setBg3LanguageFolder] = useState('')
  const { entries, modName, targetLang } = session

  const exportXml = useCallback(async () => {
    const outputPath = await window.api.fs.saveDialog({
      defaultName: `${exportFileBaseName(modName || 'traducao', targetLang)}.xml`,
      filters: [{ name: 'XML', extensions: ['xml'] }]
    })
    if (!outputPath) return

    try {
      await window.api.xml.export({ outputPath, entries })
      toast.success('XML exportado com sucesso')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao exportar XML')
    }
  }, [entries, modName, targetLang])

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
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar meta.lsx')
    }
  }, [exportFormat, exportXml, languages, modName, targetLang])

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
        toast.success(`${exportFormat.toUpperCase()} exportado com sucesso`)
        setExportMeta(null)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao exportar pacote')
      } finally {
        setIsExporting(false)
      }
    },
    [entries, exportFormat, modName]
  )

  return {
    isExporting,
    exportFormat,
    exportMeta,
    bg3LanguageFolder,
    setExportFormat,
    openExport,
    submitPackageExport,
    closeExportModal: () => setExportMeta(null)
  }
}
