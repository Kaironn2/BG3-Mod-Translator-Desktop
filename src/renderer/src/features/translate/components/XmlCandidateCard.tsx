import { cn } from '@/lib/utils'
import type { TranslationXmlCandidate } from '@/types'

interface XmlCandidateCardProps {
  candidate: TranslationXmlCandidate
  index: number
  selected: boolean
  onSelect: () => void
}

export function XmlCandidateCard({
  candidate,
  index,
  selected,
  onSelect
}: XmlCandidateCardProps): React.JSX.Element {
  return (
    <button
      type="button"
      disabled={!candidate.valid}
      onClick={onSelect}
      className={cn(
        'grid grid-cols-[56px_1fr] rounded-xl border overflow-hidden text-left transition-all',
        candidate.valid
          ? 'cursor-pointer bg-[#131518] hover:border-neutral-600'
          : 'cursor-not-allowed bg-[#101214] opacity-70',
        selected ? 'border-amber-500 bg-amber-400/10' : 'border-[#1f2329]'
      )}
    >
      <div className="bg-[#0f1114] border-r border-[#1f2329] flex items-start justify-center pt-4 font-mono text-[11px] font-bold text-neutral-600 tracking-[0.08em]">
        {(index + 1).toString().padStart(2, '0')}
      </div>
      <div className="p-4 flex items-center gap-4 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[13px] font-semibold text-neutral-200 truncate">
            {candidate.relativePath}
          </div>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-neutral-500">
            {candidate.valid ? (
              <>
                <span>{candidate.stringCount} strings</span>
                <span className="text-neutral-700">-</span>
                <span>{candidate.sizeKb} KB</span>
              </>
            ) : (
              <span className="text-red-300">Formato invalido</span>
            )}
          </div>
        </div>
        <div
          className={cn(
            'w-4.5 h-4.5 rounded-full border flex items-center justify-center shrink-0',
            selected ? 'border-amber-400' : 'border-neutral-600'
          )}
        >
          {selected && <div className="w-2 h-2 rounded-full bg-amber-400" />}
        </div>
      </div>
    </button>
  )
}
