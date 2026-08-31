import { Check, File, Loader2, Upload, X } from 'lucide-react'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { cn } from '@/lib/utils'
import { btnBase, btnGhostIcon } from './styles'

interface FileInputCardProps {
  fileName: string | null
  isDragging: boolean
  isPreparing?: boolean
  preparingLabel?: string
  prepareProgress?: { processed?: number; total?: number } | null
  onBrowse: () => Promise<void>
  onDragOver: (event: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (event: React.DragEvent) => void
  onClear: () => void
}

export function FileInputCard({
  fileName,
  isDragging,
  isPreparing = false,
  preparingLabel,
  prepareProgress,
  onBrowse,
  onDragOver,
  onDragLeave,
  onDrop,
  onClear
}: FileInputCardProps): React.JSX.Element {
  const { t } = useAppTranslation(['translate', 'common'])
  const processed = prepareProgress?.processed
  const total = prepareProgress?.total
  const hasBar = isPreparing && total !== undefined && total > 0 && processed !== undefined
  const pct = hasBar ? Math.min(100, Math.round((processed / total) * 100)) : 0

  return (
    <>
      <div>
        <h3 className="text-[15px] font-semibold text-neutral-200 tracking-tight m-0">
          {t('setup.fileCard.title', { ns: 'translate' })}
        </h3>
        <p className="text-xs text-neutral-500 mt-1 m-0">
          {t('setup.fileCard.description', { ns: 'translate' })}
        </p>
      </div>

      <section
        aria-label={t('setup.fileCard.dropZone', { ns: 'translate' })}
        aria-busy={isPreparing}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'rounded-xl border transition-all',
          fileName
            ? 'p-3.5 border-amber-500 bg-[#0f1114]'
            : isDragging
              ? 'p-8 border-dashed border-amber-500 bg-amber-400/5'
              : 'p-8 border-dashed border-[#2a2f38] bg-[#0f1114]'
        )}
      >
        {!fileName ? (
          <div className="flex flex-col items-center gap-2.5">
            <div
              aria-hidden="true"
              className={cn(
                'w-12 h-12 rounded-full border flex items-center justify-center',
                isDragging
                  ? 'border-amber-400 bg-[#131518] text-amber-400'
                  : 'border-[#1f2329] bg-neutral-900 text-neutral-500'
              )}
            >
              <Upload />
            </div>
            <div className="text-[13px] font-medium text-neutral-300">
              {t('setup.fileCard.dropPrompt', { ns: 'translate' })}
            </div>
            <div className="flex gap-1.5">
              {['.xml', '.loca', '.pak', '.zip'].map((ext) => (
                <span
                  key={ext}
                  className="font-mono text-[10px] px-1.5 py-0.5 bg-[#131518] border border-[#1f2329] rounded text-neutral-500"
                >
                  {ext}
                </span>
              ))}
            </div>
            <button type="button" onClick={onBrowse} className={btnBase}>
              <File size={13} />
              {t('setup.fileCard.browseFile', { ns: 'translate' })}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-amber-400">
                {isPreparing ? <Loader2 size={18} className="animate-spin" /> : <File size={18} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-mono text-[13px] font-semibold text-neutral-200">
                  {fileName}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-400">
                  {isPreparing ? (
                    <>
                      {preparingLabel ?? t('setup.fileCard.fileSelected', { ns: 'translate' })}
                      {hasBar ? ` · ${pct}%` : null}
                    </>
                  ) : (
                    <>
                      <Check size={10} />
                      {t('setup.fileCard.fileSelected', { ns: 'translate' })}
                    </>
                  )}
                </div>
              </div>
              <button type="button" onClick={onClear} className={btnGhostIcon}>
                <X size={14} />
              </button>
            </div>
            {isPreparing ? (
              hasBar ? (
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-[#1d2127]"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                >
                  <div
                    className="h-full rounded-full bg-amber-400/80 transition-[width] duration-200"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              ) : (
                <div className="h-1.5 animate-pulse rounded-full bg-amber-400/30" />
              )
            ) : null}
          </div>
        )}
      </section>
    </>
  )
}
