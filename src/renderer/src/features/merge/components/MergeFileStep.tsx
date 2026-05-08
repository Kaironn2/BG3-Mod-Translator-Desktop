import { ArrowRight } from 'lucide-react'
import { useAppTranslation } from '@/i18n/useAppTranslation'
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
  const { t } = useAppTranslation('merge')

  return (
    <SetupStepCard step={step}>
      <div>
        <h3 className="m-0 text-[15px] font-semibold tracking-tight text-neutral-200">{title}</h3>
        <p className="mt-1 m-0 text-xs text-neutral-500">{description}</p>
      </div>

      <div className="grid grid-cols-[1fr_auto] items-end gap-3.5">
        <div>
          <span className="mb-1.5 block text-[10px] font-semibold tracking-[0.08em] text-neutral-500 uppercase">
            {t('language')}
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
  const { t } = useAppTranslation('merge')
  const candidate = slot.prepared?.candidates.find((item) => item.id === slot.candidateId)
  if (!candidate) return null
  return (
    <div className="flex items-center gap-2 px-2 font-mono text-[11px] text-neutral-500">
      <span className="text-amber-400">{t('candidateSummary.xml')}</span>
      <span className="flex-1 truncate">{candidate.relativePath}</span>
      <span>{t('candidateSummary.entries', { count: candidate.stringCount })}</span>
    </div>
  )
}
