import { FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ModalShell } from '@/components/shared/ModalShell'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { cn } from '@/lib/utils'
import type { DictionaryImportPreview } from '@/types'

interface DictionaryImportModalProps {
  open: boolean
  onClose: () => void
  onImported: () => Promise<void>
}

export function DictionaryImportModal({
  open,
  onClose,
  onImported
}: DictionaryImportModalProps): React.JSX.Element | null {
  const { t } = useAppTranslation(['dictionary', 'common', 'toasts'])
  const [filePath, setFilePath] = useState('')
  const [preview, setPreview] = useState<DictionaryImportPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<{ processed: number; total: number } | null>(
    null
  )
  const [isDragging, setIsDragging] = useState(false)
  const unsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!open) {
      setFilePath('')
      setPreview(null)
      setLoading(false)
      setImporting(false)
      setImportProgress(null)
      unsubRef.current?.()
      unsubRef.current = null
    }
  }, [open])

  const loadPreview = async (nextPath: string) => {
    if (loading || importing) return
    setLoading(true)
    try {
      const nextPreview = await window.api.dictionary.previewImport({
        filePath: nextPath,
        format: 'csv'
      })
      setFilePath(nextPath)
      setPreview(nextPreview)
    } catch (error) {
      toast.error(getLocalizedErrorMessage(error, t))
    } finally {
      setLoading(false)
    }
  }

  const handleSelectFile = async () => {
    const paths = await window.api.fs.openDialog({
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (!paths[0]) return
    await loadPreview(paths[0])
  }

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files[0]
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error(t('importModal.invalidCsv', { ns: 'dictionary' }))
      return
    }
    await loadPreview(window.api.fs.getPathForFile(file))
  }

  const handleImport = async () => {
    if (!filePath) return
    setImporting(true)
    setImportProgress(null)

    unsubRef.current = window.api.dictionary.onImportProgress((p) => {
      if (p.phase === 'writing') {
        setImportProgress({ processed: p.processed, total: p.total })
      }
    })

    try {
      const result = await window.api.dictionary.import({ filePath, format: 'csv' })
      toast.success(t('dictionary.imported', { ns: 'toasts', count: result.count }))
      await onImported()
      onClose()
    } catch (error) {
      toast.error(getLocalizedErrorMessage(error, t))
    } finally {
      unsubRef.current?.()
      unsubRef.current = null
      setImporting(false)
      setImportProgress(null)
    }
  }

  return (
    <ModalShell
      open={open}
      title={t('importModal.title', { ns: 'dictionary' })}
      description={t('importModal.description', { ns: 'dictionary' })}
      icon={<FileSpreadsheet size={16} />}
      sizeClassName="max-w-2xl"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 cursor-pointer items-center rounded-md border border-neutral-700 bg-[#131518] px-3 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-800"
          >
            {t('actions.cancel', { ns: 'common' })}
          </button>
          <button
            type="button"
            disabled={!preview || importing || loading}
            onClick={handleImport}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-amber-500 bg-amber-500 px-3 text-xs font-semibold text-neutral-950 transition-colors hover:border-amber-400 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Upload size={13} />
            {importing && importProgress
              ? `${importProgress.processed.toLocaleString()} / ${importProgress.total.toLocaleString()}`
              : importing
                ? t('importModal.importing', { ns: 'dictionary' })
                : t('importModal.importCount', {
                    ns: 'dictionary',
                    count: preview?.totalRows ?? 0
                  })}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {importing && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-neutral-500">
              <span>
                {importProgress ? t('importModal.importing', { ns: 'dictionary' }) : '...'}
              </span>
              {importProgress && (
                <span className="font-mono">
                  {importProgress.processed.toLocaleString()} /{' '}
                  {importProgress.total.toLocaleString()}
                </span>
              )}
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1f2329]">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-200"
                style={{
                  width: importProgress
                    ? `${Math.round((importProgress.processed / importProgress.total) * 100)}%`
                    : '0%'
                }}
              />
            </div>
          </div>
        )}
        <button
          type="button"
          disabled={loading || importing}
          onClick={() => {
            void handleSelectFile()
          }}
          onDragOver={(event) => {
            event.preventDefault()
            if (!loading && !importing) setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            void handleDrop(event)
          }}
          className={cn(
            'flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-[#0f1114] px-6 py-6 text-center transition-colors',
            isDragging
              ? 'border-amber-500 bg-amber-500/6'
              : 'border-[#3a404a] hover:border-amber-500 hover:bg-amber-500/6',
            (loading || importing) && 'cursor-wait opacity-70'
          )}
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin text-amber-400" />
          ) : (
            <Upload size={18} className="text-neutral-300" />
          )}
          <div className="text-sm font-semibold text-neutral-100">
            {loading
              ? t('importModal.reading', { ns: 'dictionary' })
              : filePath
                ? filePath.split(/[\\/]/).pop()
                : t('importModal.chooseFile', { ns: 'dictionary' })}
          </div>
          <div className="text-xs text-neutral-500">
            {t('importModal.chooseFileDescription', { ns: 'dictionary' })}
          </div>
        </button>

        {preview && (
          <>
            <div className="rounded-lg border border-[#1f2329] bg-[#0f1114] p-3 text-xs text-neutral-400">
              <div className="flex flex-wrap items-center gap-3">
                <span>
                  {t('importModal.detectedRows', { ns: 'dictionary', count: preview.totalRows })}
                </span>
                <span className="font-mono text-neutral-500">
                  {t('importModal.headers', {
                    ns: 'dictionary',
                    headers: preview.headers.join(', ')
                  })}
                </span>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-[#1f2329] bg-[#0f1114]">
              <div className="flex items-center justify-between border-b border-[#1f2329] px-3 py-2 text-[11px] text-neutral-500">
                <span>
                  {t('importModal.preview', {
                    ns: 'dictionary',
                    count: preview.rows.length
                  })}
                </span>
                <span className="font-mono">{t('importModal.format', { ns: 'dictionary' })}</span>
              </div>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-[#131518]">
                    <th className="px-3 py-2 text-left font-semibold tracking-[0.06em] text-neutral-500 uppercase">
                      {t('entryModal.textLanguage1', { ns: 'dictionary' })}
                    </th>
                    <th className="px-3 py-2 text-left font-semibold tracking-[0.06em] text-neutral-500 uppercase">
                      {t('entryModal.textLanguage2', { ns: 'dictionary' })}
                    </th>
                    <th className="px-3 py-2 text-left font-semibold tracking-[0.06em] text-neutral-500 uppercase">
                      {t('importModal.mod', { ns: 'dictionary' })}
                    </th>
                    <th className="px-3 py-2 text-left font-semibold tracking-[0.06em] text-neutral-500 uppercase">
                      {t('importModal.languages', { ns: 'dictionary' })}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, index) => (
                    <tr key={`${row.uid ?? 'row'}-${index}`} className="border-t border-[#1f2329]">
                      <td className="px-3 py-2 font-mono text-neutral-200">{row.sourceText}</td>
                      <td className="px-3 py-2 font-mono text-neutral-200">{row.targetText}</td>
                      <td className="px-3 py-2 text-neutral-300">
                        {row.modName || t('importModal.noMod', { ns: 'dictionary' })}
                      </td>
                      <td className="px-3 py-2 font-mono text-neutral-400">
                        {(row.sourceLang || '-').toUpperCase()} -&gt;{' '}
                        <span className="text-amber-400">
                          {(row.targetLang || '-').toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  )
}
