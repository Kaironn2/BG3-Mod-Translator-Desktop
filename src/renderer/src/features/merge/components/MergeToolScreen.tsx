import { Merge } from 'lucide-react'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { XmlSelectionModal } from '@/features/translate/components/XmlSelectionModal'
import type { PreparedTranslationInput } from '@/types'
import { useMergeSetup } from '../hooks/useMergeSetup'
import type { SlotKey } from '../types'
import { MergeBottomBar } from './MergeBottomBar'
import { MergeFileStep } from './MergeFileStep'
import { MergeNameStep } from './MergeNameStep'

export function MergeToolScreen(): React.JSX.Element {
  const { t } = useAppTranslation('merge')
  const setup = useMergeSetup()
  const pendingSlot =
    setup.pendingSelection === 'source'
      ? setup.source
      : setup.pendingSelection === 'target'
        ? setup.target
        : null

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-10 shrink-0 items-center gap-3 border-b border-[#1f2329] bg-[#131518] px-5">
          <span className="flex items-center gap-1.5 font-mono text-[12px] text-neutral-200">
            <Merge size={12} />
            {t('title')}
          </span>
          <span className="flex-1" />
          <span className="flex items-center gap-2 font-mono text-[11px]">
            <span className={setup.step1Done ? 'text-amber-400' : 'text-neutral-600'}>
              1 {t('steps.source')}
            </span>
            <span className="text-neutral-700">-</span>
            <span className={setup.step2Done ? 'text-amber-400' : 'text-neutral-600'}>
              2 {t('steps.translated')}
            </span>
            <span className="text-neutral-700">-</span>
            <span className={setup.step3Done ? 'text-amber-400' : 'text-neutral-600'}>
              3 {t('steps.mod')}
            </span>
          </span>
        </div>

        <div className="icosa-scroll min-h-0 flex-1 overflow-y-auto px-6 pt-7 pb-6 [scrollbar-gutter:stable]">
          <div className="mx-auto flex max-w-220 flex-col gap-3.5">
            <MergeFileStep
              step="01"
              title={t('sourceFile.title')}
              description={t('sourceFile.description')}
              slot={setup.source}
              slotKey="source"
              languages={setup.languages}
              onLangChange={setup.setSourceLang}
              onBrowse={setup.browseFile}
              onDrop={setup.dropFile}
              onDragChange={setup.setDragging}
              onClear={setup.clearFile}
            />

            <MergeFileStep
              step="02"
              title={t('translatedFile.title')}
              description={t('translatedFile.description')}
              slot={setup.target}
              slotKey="target"
              languages={setup.languages}
              accent
              onLangChange={setup.setTargetLang}
              onBrowse={setup.browseFile}
              onDrop={setup.dropFile}
              onDragChange={setup.setDragging}
              onClear={setup.clearFile}
            />

            <MergeNameStep value={setup.modName} onChange={setup.setModName} />
          </div>
        </div>

        <MergeBottomBar
          ready={setup.ready}
          isRunning={setup.isRunning}
          onCancel={() => {
            void setup.reset()
          }}
          onRun={() => {
            void setup.runMerge()
          }}
        />
      </div>

      {pendingSlot?.prepared && setup.pendingSelection && (
        <PendingSelectionModal
          prepared={pendingSlot.prepared}
          slotKey={setup.pendingSelection}
          onCancel={setup.closeSelection}
          onSelect={setup.selectCandidate}
        />
      )}
    </>
  )
}

interface PendingSelectionModalProps {
  prepared: PreparedTranslationInput
  slotKey: SlotKey
  onCancel: () => Promise<void>
  onSelect: (slotKey: SlotKey, candidateId: string) => void
}

function PendingSelectionModal({
  prepared,
  slotKey,
  onCancel,
  onSelect
}: PendingSelectionModalProps): React.JSX.Element {
  return (
    <XmlSelectionModal
      prepared={prepared}
      onCancel={onCancel}
      onSelect={async ([candidateId]) => {
        if (!candidateId) return
        onSelect(slotKey, candidateId)
      }}
    />
  )
}
