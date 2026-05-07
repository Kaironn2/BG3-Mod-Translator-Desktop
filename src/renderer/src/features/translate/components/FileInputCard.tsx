import { Check, File, Upload, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { btnBase, btnGhostIcon } from './styles'

interface FileInputCardProps {
  fileName: string | null
  isDragging: boolean
  onBrowse: () => Promise<void>
  onDragOver: (event: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (event: React.DragEvent) => void
  onClear: () => void
}

export function FileInputCard({
  fileName,
  isDragging,
  onBrowse,
  onDragOver,
  onDragLeave,
  onDrop,
  onClear
}: FileInputCardProps): React.JSX.Element {
  return (
    <>
      <div>
        <h3 className="text-[15px] font-semibold text-neutral-200 tracking-tight m-0">
          Arquivo do mod
        </h3>
        <p className="text-xs text-neutral-500 mt-1 m-0">
          Solte aqui ou navegue. Aceita .xml, .pak, .zip.
        </p>
      </div>

      <section
        aria-label="Zona de arrastar arquivo"
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
              Arraste o arquivo do mod aqui
            </div>
            <div className="flex gap-1.5">
              {['.xml', '.pak', '.zip'].map((ext) => (
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
              Procurar arquivo
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-400/10 text-amber-400 flex items-center justify-center shrink-0">
              <File size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-[13px] font-semibold text-neutral-200 truncate">
                {fileName}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-amber-400 mt-0.5">
                <Check size={10} />
                Arquivo selecionado
              </div>
            </div>
            <button type="button" onClick={onClear} className={btnGhostIcon}>
              <X size={14} />
            </button>
          </div>
        )}
      </section>
    </>
  )
}
