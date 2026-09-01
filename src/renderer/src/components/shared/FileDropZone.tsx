import { Check, File, FolderOpen, Loader2, Upload, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { cn } from '@/lib/utils'

interface FileDropZoneProps {
  /** 'file' validates dropped extensions against `accept`; 'folder' only accepts directories. */
  mode?: 'file' | 'folder'
  /** Extensions without dots, used in 'file' mode (badges + drop validation). */
  accept?: string[]
  value: string
  label: string
  onFile: (path: string) => void
  onClear: () => void
  disabled?: boolean
  className?: string
}

function isAccepted(name: string, accept: string[]): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return accept.includes(ext)
}

function baseName(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || filePath
}

export function FileDropZone({
  mode = 'file',
  accept,
  value,
  label,
  onFile,
  onClear,
  disabled = false,
  className
}: FileDropZoneProps): React.JSX.Element {
  const { t } = useAppTranslation('common')
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [browsing, setBrowsing] = useState(false)
  const hasValue = value.trim().length > 0

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return
      e.preventDefault()
      setIsDragging(true)
    },
    [disabled]
  )

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      if (disabled) return
      setError(null)

      const file = e.dataTransfer.files[0]
      if (!file) return

      if (mode === 'folder') {
        // webkitGetAsEntry must be read synchronously, before any await.
        const entry = e.dataTransfer.items[0]?.webkitGetAsEntry?.()
        if (entry && !entry.isDirectory) {
          setError(t('dragDrop.folderOnly'))
          return
        }
        onFile(window.api.fs.getPathForFile(file))
        return
      }

      if (!accept || !isAccepted(file.name, accept)) {
        setError(t('dragDrop.acceptedFormats', { formats: (accept ?? []).join(', .') }))
        return
      }

      onFile(window.api.fs.getPathForFile(file))
    },
    [accept, disabled, mode, onFile, t]
  )

  const handleBrowse = useCallback(async () => {
    if (disabled) return
    setError(null)
    setBrowsing(true)
    try {
      if (mode === 'folder') {
        const folder = await window.api.fs.openFolder()
        if (folder) onFile(folder)
        return
      }
      const paths = await window.api.fs.openDialog({
        filters: [{ name: 'Mod files', extensions: accept ?? [] }]
      })
      if (paths[0]) onFile(paths[0])
    } finally {
      setBrowsing(false)
    }
  }, [accept, disabled, mode, onFile])

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drag & drop zone
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'rounded-xl border transition-all',
        hasValue
          ? 'border-solid border-amber-500 bg-amber-400/5 p-5'
          : isDragging
            ? 'border-dashed border-amber-500 bg-amber-400/5 p-9'
            : 'border-dashed border-[#3a3a3a] bg-[#121212] p-9 hover:border-neutral-600',
        className
      )}
    >
      {hasValue ? (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-amber-400">
            {mode === 'folder' ? <FolderOpen size={18} /> : <File size={18} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-mono text-[13px] font-semibold text-neutral-200">
              {baseName(value)}
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-400">
              <Check size={10} />
              {t('status.selected')}
            </div>
          </div>
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="inline-flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={t('actions.clear')}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2.5 text-center">
          <div
            aria-hidden="true"
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full border',
              isDragging
                ? 'border-amber-400 bg-[#131518] text-amber-400'
                : 'border-[#1f2329] bg-neutral-900 text-neutral-500'
            )}
          >
            {mode === 'folder' ? <FolderOpen size={22} /> : <Upload size={22} />}
          </div>
          <p className="m-0 text-[15px] font-medium text-neutral-200">{label}</p>
          <p className="m-0 text-[13px] text-neutral-500">{t('dragDrop.orBrowse')}</p>
          {mode === 'file' && accept && accept.length > 0 && (
            <div className="flex gap-1.5">
              {accept.map((ext) => (
                <span
                  key={ext}
                  className="rounded border border-[#1f2329] bg-[#131518] px-1.5 py-0.5 font-mono text-[10px] text-neutral-500"
                >
                  .{ext}
                </span>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => void handleBrowse()}
            disabled={disabled || browsing}
            className="mt-1 inline-flex h-[34px] cursor-pointer items-center gap-1.5 rounded-lg border border-[#3a3a3a] bg-transparent px-4 text-[13px] font-medium text-neutral-400 transition-colors hover:border-[#555] hover:bg-[#1a1a1a] hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {browsing ? <Loader2 size={13} className="animate-spin" /> : null}
            {t('actions.browse')}
          </button>
          {error && <p className="m-0 text-xs text-red-400">{error}</p>}
        </div>
      )}
    </div>
  )
}
