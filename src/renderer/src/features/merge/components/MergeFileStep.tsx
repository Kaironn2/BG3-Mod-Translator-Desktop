import { ArrowRight } from 'lucide-react'
import { FileInputCard } from '@/features/translate/components/FileInputCard'
import { LanguagePicker } from '@/features/translate/components/LanguagePicker'
import { SetupStepCard } from '@/features/translate/components/SetupStepCard'
import type { Language } from '@/types'
import type { MergeFileSlot, SlotKey } from '../types'

interface MergeFileStepProps {
  step: string
  title: string
  description: string
  slot: MergeFileSlot
  slotKey: SlotKey
  languages: Language[]
  accent?: boolean
  onLangChange: (code: string) => void
  onBrowse: (slot: SlotKey) => Promise<void>
  onDrop: (slot: SlotKey, event: React.DragEvent) => Promise<void>
  onDragChange: (slot: SlotKey, dragging: boolean) => void
  onClear: (slot: SlotKey) => Promise<void>
}

export function MergeFileStep({
  step,
  title,
  description,
  slot,
  slotKey,
  languages,
  accent,
  onLangChange,
  onBrowse,
  onDrop,
  onDragChange,
  onClear
}: MergeFileStepProps): React.JSX.Element {
  return (
    <SetupStepCard step={step}>
      <div>
        <h3 className="text-[15px] font-semibold text-neutral-200 tracking-tight m-0">{title}</h3>
        <p className="text-xs text-neutral-500 mt-1 m-0">{description}</p>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3.5 items-end">
        <div>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500 mb-1.5">
            Idioma
          </span>
          <LanguagePicker
            value={slot.lang}
            onChange={onLangChange}
            languages={languages}
            accent={accent}
          />
        </div>
        <div className="pb-2 text-neutral-600">
          <ArrowRight size={16} />
        </div>
      </div>

      <FileInputCard
        fileName={slot.fileName}
        isDragging={slot.isDragging}
        onBrowse={() => onBrowse(slotKey)}
        onDragOver={(event) => {
          event.preventDefault()
          onDragChange(slotKey, true)
        }}
        onDragLeave={() => onDragChange(slotKey, false)}
        onDrop={(event) => {
          void onDrop(slotKey, event)
        }}
        onClear={() => {
          void onClear(slotKey)
        }}
      />

      {slot.prepared && slot.candidateId && <CandidateSummary slot={slot} />}
    </SetupStepCard>
  )
}

function CandidateSummary({ slot }: { slot: MergeFileSlot }): React.JSX.Element | null {
  const candidate = slot.prepared?.candidates.find((item) => item.id === slot.candidateId)
  if (!candidate) return null
  return (
    <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-mono px-2">
      <span className="text-amber-400">XML</span>
      <span className="truncate flex-1">{candidate.relativePath}</span>
      <span>{candidate.stringCount} entradas</span>
    </div>
  )
}
