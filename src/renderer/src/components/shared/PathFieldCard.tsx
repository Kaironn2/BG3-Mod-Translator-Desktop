import { Upload, X } from 'lucide-react'
import { useState } from 'react'
import { btnBase, btnGhostIcon } from '@/features/translate/components/styles'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { cn } from '@/lib/utils'

interface PathFieldCardProps {
  icon: React.ReactNode
  value: string
  placeholder: string
  browseLabel: string
  prompt?: string
  /** When set, enables drag & drop of files with these extensions (no dots). */
  accept?: string[]
  onPick: () => void | Promise<void>
  onFile?: (path: string) => void
  onClear: () => void
  disabled?: boolean
}

export function PathFieldCard({
  icon,
  value,
  placeholder,
  browseLabel,
  prompt,
  accept,
  onPick,
  onFile,
  onClear,
  disabled = false
}: PathFieldCardProps): React.JSX.Element {
  const { t } = useAppTranslation('common')
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasValue = value.trim().length > 0

  const handleDragOver = (e: React.DragEvent): void => {
    if (!accept || disabled) return
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (): void => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent): void => {
    setIsDragging(false)
    if (!accept || !onFile || disabled) return
    e.preventDefault()
    setError(null)

    const file = e.dataTransfer.files[0]
    if (!file) return

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!accept.includes(ext)) {
      setError(t('dragDrop.acceptedFormats', { formats: accept.join(', .') }))
      return
    }

    onFile(window.api.fs.getPathForFile(file))
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drag & drop zone, same as DragDrop/FileInputCard
    <div
      onDragOver={accept ? handleDragOver : undefined}
      onDragLeave={accept ? handleDragLeave : undefined}
      onDrop={accept ? handleDrop : undefined}
      className={cn(
        'rounded-xl border bg-[#0f1114] transition-all',
        hasValue
          ? 'border-amber-500 p-3.5'
          : isDragging
            ? 'border-dashed border-amber-500 bg-amber-400/5 p-8'
            : 'border-dashed border-[#2a2f38] p-8'
      )}
    >
      {hasValue ? (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-amber-400">
            {icon}
          </div>
          <div
            className="min-w-0 flex-1 truncate font-mono text-[13px] font-semibold text-neutral-200"
            title={value}
          >
            {value}
          </div>
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className={btnGhostIcon}
            aria-label={t('actions.clear')}
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2.5">
          <div
            aria-hidden="true"
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full border',
              isDragging
                ? 'border-amber-400 bg-[#131518] text-amber-400'
                : 'border-[#1f2329] bg-neutral-900 text-neutral-500'
            )}
          >
            {icon}
          </div>
          <div className="text-[13px] font-medium text-neutral-300">{prompt ?? placeholder}</div>
          {accept && (
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
            onClick={() => void onPick()}
            disabled={disabled}
            className={btnBase}
          >
            <Upload size={13} />
            {browseLabel}
          </button>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}
    </div>
  )
}
