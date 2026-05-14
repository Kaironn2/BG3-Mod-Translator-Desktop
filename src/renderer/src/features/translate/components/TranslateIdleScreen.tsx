import { ArrowRight, File, Loader2 } from 'lucide-react'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { cn } from '@/lib/utils'
import { useTranslateSetup } from '../hooks/useTranslateSetup'
import { useTranslationImport } from '../hooks/useTranslationImport'
import type { TranslationSession } from '../types'
import { FileInputCard } from './FileInputCard'
import { LanguagePicker } from './LanguagePicker'
import { ModSelectionCard } from './ModSelectionCard'
import { SetupStepCard } from './SetupStepCard'
import { btnBase, btnPrimary } from './styles'
import { XmlSelectionModal } from './XmlSelectionModal'

interface TranslateIdleScreenProps {
  session: TranslationSession
}

export function TranslateIdleScreen({ session }: TranslateIdleScreenProps): React.JSX.Element {
  const { t } = useAppTranslation(['translate', 'common'])
  const setup = useTranslateSetup(session)
  const importFlow = useTranslationImport({
    session,
    sourceLang: setup.sourceLang,
    targetLang: setup.targetLang,
    modName: setup.modName
  })
  const isLoading = session.phase === 'loading' || importFlow.isPreparing
  const loadingLabel =
    importFlow.isPreparing && session.phase !== 'loading'
      ? t('setup.loadingPreparingFile', { ns: 'translate' })
      : session.loadingLabel || t('setup.loadingEditor', { ns: 'translate' })

  return (
    <>
      <div className="relative flex h-full min-h-0 flex-col">
        <div className="flex h-10 shrink-0 items-center gap-3 border-b border-[#1f2329] bg-[#131518] px-5">
          <span className="flex items-center gap-1.5 font-mono text-[12px] text-neutral-200">
            <File size={12} />
            {t('newProject', { ns: 'translate' })}
          </span>
          <span className="flex-1" />
          <span className="flex items-center gap-2 font-mono text-[11px]">
            <span className={setup.step1Done ? 'text-amber-400' : 'text-neutral-600'}>
              1 {t('setup.steps.languages', { ns: 'translate' })}
            </span>
            <span className="text-neutral-700">-</span>
            <span className={setup.step2Done ? 'text-amber-400' : 'text-neutral-600'}>
              2 {t('setup.steps.mod', { ns: 'translate' })}
            </span>
            <span className="text-neutral-700">-</span>
            <span className={setup.step3Done ? 'text-amber-400' : 'text-neutral-600'}>
              3 {t('setup.steps.file', { ns: 'translate' })}
            </span>
          </span>
        </div>

        <div className="icosa-scroll min-h-0 flex-1 overflow-y-auto px-6 pt-7 pb-6 [scrollbar-gutter:stable]">
          <div className="mx-auto flex max-w-220 flex-col gap-3.5">
            <SetupStepCard step="01">
              <div>
                <h3 className="m-0 text-[15px] font-semibold tracking-tight text-neutral-200">
                  {t('setup.languagePair.title', { ns: 'translate' })}
                </h3>
                <p className="mt-1 m-0 text-xs text-neutral-500">
                  {t('setup.languagePair.description', { ns: 'translate' })}
                </p>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3.5">
                <div>
                  <span className="mb-1.5 block text-[10px] font-semibold tracking-[0.08em] text-neutral-500 uppercase">
                    {t('setup.languagePair.source', { ns: 'translate' })}
                  </span>
                  <LanguagePicker
                    value={setup.sourceLang}
                    onChange={setup.handleSourceChange}
                    languages={setup.languages}
                  />
                </div>
                <div className="pb-2 text-neutral-500">
                  <ArrowRight size={18} />
                </div>
                <div>
                  <span className="mb-1.5 block text-[10px] font-semibold tracking-[0.08em] text-neutral-500 uppercase">
                    {t('setup.languagePair.target', { ns: 'translate' })}
                  </span>
                  <LanguagePicker
                    value={setup.targetLang}
                    onChange={setup.handleTargetChange}
                    languages={setup.languages}
                    accent
                  />
                </div>
              </div>
            </SetupStepCard>

            <SetupStepCard step="02">
              <ModSelectionCard
                isNewMod={setup.isNewMod}
                selectedMod={setup.selectedMod}
                newModName={setup.newModName}
                mods={setup.mods}
                filteredMods={setup.filteredMods}
                pagedMods={setup.pagedMods}
                modSearch={setup.modSearch}
                clampedPage={setup.clampedPage}
                totalPages={setup.totalPages}
                onExistingMode={() => setup.setIsNewMod(false)}
                onNewMode={() => setup.setIsNewMod(true)}
                onNewModNameChange={setup.setNewModName}
                onModSearchChange={setup.handleModSearchChange}
                onModSelect={setup.handleModSelect}
                onPageChange={setup.setModPage}
              />
            </SetupStepCard>

            <SetupStepCard step="03">
              <FileInputCard
                fileName={setup.fileName}
                isDragging={setup.isDragging}
                onBrowse={setup.handleBrowse}
                onDragOver={(event) => {
                  event.preventDefault()
                  setup.setIsDragging(true)
                }}
                onDragLeave={() => setup.setIsDragging(false)}
                onDrop={setup.handleDrop}
                onClear={setup.clearFile}
              />
            </SetupStepCard>
          </div>
        </div>

        <div className="shrink-0 border-t border-[#1f2329] px-6 py-3">
          <div className="mx-auto flex max-w-220 items-center gap-2.5 rounded-xl border border-neutral-700 bg-[#131518] px-4 py-3 shadow-xl">
            <div className="flex-1 text-xs text-neutral-400">
              {setup.ready
                ? t('setup.ready', {
                    ns: 'translate',
                    source: setup.srcLang?.name ?? setup.sourceLang,
                    target: setup.tgtLang?.name ?? setup.targetLang
                  })
                : t('setup.idle', { ns: 'translate' })}
            </div>
            <button type="button" className={btnBase} onClick={session.resetSession}>
              {t('actions.cancel', { ns: 'common' })}
            </button>
            <button
              type="button"
              className={cn(
                btnPrimary,
                (!setup.ready || isLoading) && 'cursor-not-allowed opacity-40'
              )}
              disabled={!setup.ready || isLoading}
              onClick={() => importFlow.openFile(setup.filePath, setup.ready)}
            >
              {isLoading ? <Loader2 size={13} className="animate-spin" /> : null}
              {t('setup.openEditor', { ns: 'translate' })}
              {!isLoading && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded border border-neutral-800 bg-neutral-950/30 px-1 font-mono text-[10px] text-neutral-300">
                  Enter
                </span>
              )}
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0f1114]/80 backdrop-blur-[2px]">
            <div className="flex w-full max-w-md flex-col gap-4 rounded-2xl border border-[#2a2f37] bg-[#131518] px-5 py-5 shadow-2xl">
              <div className="flex items-center gap-3">
                <Loader2 size={18} className="animate-spin text-amber-400" />
                <div className="text-sm font-semibold text-neutral-200">{loadingLabel}</div>
              </div>
              <div className="space-y-2">
                <div className="h-2 rounded-full bg-[#1d2127]">
                  <div className="h-full w-2/3 animate-pulse rounded-full bg-amber-400/80" />
                </div>
                <div className="grid gap-2">
                  <div className="h-8 animate-pulse rounded-lg bg-[#1a1d22]" />
                  <div className="h-8 animate-pulse rounded-lg bg-[#1a1d22]" />
                  <div className="h-8 animate-pulse rounded-lg bg-[#1a1d22]" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {importFlow.preparedImport && (
        <XmlSelectionModal
          prepared={importFlow.preparedImport}
          selectionMode="multi"
          onCancel={importFlow.closeImportModal}
          onSelect={(candidateIds) =>
            importFlow.preparedImport
              ? importFlow.completeImport(importFlow.preparedImport.importId, candidateIds)
              : Promise.resolve()
          }
        />
      )}
    </>
  )
}
