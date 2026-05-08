import { FileSpreadsheet, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ModalShell } from '@/components/shared/ModalShell'
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
  const [filePath, setFilePath] = useState('')
  const [preview, setPreview] = useState<DictionaryImportPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (!open) {
      setFilePath('')
      setPreview(null)
      setLoading(false)
      setImporting(false)
    }
  }, [open])

  const handleSelectFile = async () => {
    const paths = await window.api.fs.openDialog({
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (!paths[0]) return

    setLoading(true)
    try {
      const nextPreview = await window.api.dictionary.previewImport({
        filePath: paths[0],
        format: 'csv'
      })
      setFilePath(paths[0])
      setPreview(nextPreview)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao ler CSV')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!filePath) return
    setImporting(true)
    try {
      const result = await window.api.dictionary.import({ filePath, format: 'csv' })
      toast.success(`${result.count} entradas importadas`)
      await onImported()
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao importar CSV')
    } finally {
      setImporting(false)
    }
  }

  return (
    <ModalShell
      open={open}
      title="Importar dicionario"
      description="Compatibilidade com `language1/...` e `src/tgt/src_lang/tgt_lang`."
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
            Cancelar
          </button>
          <button
            type="button"
            disabled={!preview || importing}
            onClick={handleImport}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-amber-500 bg-amber-500 px-3 text-xs font-semibold text-neutral-950 transition-colors hover:border-amber-400 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Upload size={13} />
            {importing ? 'Importando...' : `Importar ${preview?.totalRows ?? 0} entradas`}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={handleSelectFile}
          className="flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#3a404a] bg-[#0f1114] px-6 py-6 text-center transition-colors hover:border-amber-500 hover:bg-amber-500/6"
        >
          <Upload size={18} className="text-neutral-300" />
          <div className="text-sm font-semibold text-neutral-100">
            {filePath ? filePath.split(/[\\/]/).pop() : 'Escolher arquivo CSV'}
          </div>
          <div className="text-xs text-neutral-500">
            Abra um CSV para visualizar headers detectados e uma previa antes de importar.
          </div>
        </button>

        {loading && <p className="text-sm text-neutral-500">Lendo arquivo...</p>}

        {preview && (
          <>
            <div className="rounded-lg border border-[#1f2329] bg-[#0f1114] p-3 text-xs text-neutral-400">
              <div className="flex flex-wrap items-center gap-3">
                <span>{preview.totalRows} linhas detectadas</span>
                <span className="font-mono text-neutral-500">
                  Headers: {preview.headers.join(', ')}
                </span>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-[#1f2329] bg-[#0f1114]">
              <div className="flex items-center justify-between border-b border-[#1f2329] px-3 py-2 text-[11px] text-neutral-500">
                <span>Previa das primeiras {preview.rows.length} linhas</span>
                <span className="font-mono">UTF-8 . CSV</span>
              </div>
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-[#131518]">
                    <th className="px-3 py-2 text-left font-semibold uppercase tracking-[0.06em] text-neutral-500">
                      Idioma 1
                    </th>
                    <th className="px-3 py-2 text-left font-semibold uppercase tracking-[0.06em] text-neutral-500">
                      Idioma 2
                    </th>
                    <th className="px-3 py-2 text-left font-semibold uppercase tracking-[0.06em] text-neutral-500">
                      Mod
                    </th>
                    <th className="px-3 py-2 text-left font-semibold uppercase tracking-[0.06em] text-neutral-500">
                      Idiomas
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, index) => (
                    <tr key={`${row.uid ?? 'row'}-${index}`} className="border-t border-[#1f2329]">
                      <td className="px-3 py-2 font-mono text-neutral-200">{row.sourceText}</td>
                      <td className="px-3 py-2 font-mono text-neutral-200">{row.targetText}</td>
                      <td className="px-3 py-2 text-neutral-300">{row.modName || 'Sem mod'}</td>
                      <td className="px-3 py-2 font-mono text-neutral-400">
                        {(row.sourceLang || '-').toUpperCase()} -&gt;{' '}
                        <span className="text-amber-400">{(row.targetLang || '-').toUpperCase()}</span>
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
