import { ArrowRight } from 'lucide-react'
import { FileInputCard } from '@/features/translate/components/FileInputCard'
import { LanguagePicker } from '@/features/translate/components/LanguagePicker'
import { SetupStepCard } from '@/features/translate/components/SetupStepCard'
import { useAppTranslation } from '@/i18n/useAppTranslation'
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
  const phase = slot.prepareProgress?.phase
  const preparingLabel =
    phase === 'extracting'
      ? t('preparing.extracting')
      : phase === 'unpacking'
        ? t('preparing.unpacking')
        : phase === 'scanning'
          ? t('preparing.scanning')
          : t('preparing.file')

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
        isPreparing={slot.isPreparing}
        preparingLabel={preparingLabel}
        prepareProgress={slot.prepareProgress}
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

      {slot.prepared && slot.candidateIds.length > 0 && <CandidateSummary slot={slot} />}
    </SetupStepCard>
  )
}

function CandidateSummary({ slot }: { slot: MergeFileSlot }): React.JSX.Element | null {
  const { t } = useAppTranslation('merge')
  const selected = slot.prepared?.candidates.filter((item) => slot.candidateIds.includes(item.id))
  if (!selected || selected.length === 0) return null
  const totalStrings = selected.reduce((sum, candidate) => sum + candidate.stringCount, 0)
  return (
    <div className="flex flex-col gap-1 px-2">
      {selected.map((candidate) => (
        <div
          key={candidate.id}
          className="flex items-center gap-2 font-mono text-[11px] text-neutral-500"
        >
          <span className="text-amber-400">
            {candidate.fileType === 'loca'
              ? t('candidateSummary.loca')
              : t('candidateSummary.xml')}
          </span>
          <span className="flex-1 truncate">{candidate.relativePath}</span>
          <span>{t('candidateSummary.entries', { count: candidate.stringCount })}</span>
        </div>
      ))}
      {selected.length > 1 && (
        <div className="flex items-center gap-2 font-mono text-[11px] text-neutral-400">
          <span className="text-amber-400">{selected.length}</span>
          <span className="flex-1 truncate">{t('candidateSummary.filesSelected')}</span>
          <span>{t('candidateSummary.entries', { count: totalStrings })}</span>
        </div>
      )}
    </div>
  )
}
