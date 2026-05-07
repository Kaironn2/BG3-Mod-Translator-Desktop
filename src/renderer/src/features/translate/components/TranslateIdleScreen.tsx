import { ArrowRight, File, Loader2 } from 'lucide-react'
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
  const setup = useTranslateSetup(session)
  const importFlow = useTranslationImport({
    session,
    sourceLang: setup.sourceLang,
    targetLang: setup.targetLang,
    modName: setup.modName
  })
  const isLoading = session.phase === 'loading' || importFlow.isPreparing

  return (
    <>
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center gap-3 px-5 h-10 border-b border-[#1f2329] bg-[#131518] shrink-0">
          <span className="flex items-center gap-1.5 font-mono text-[12px] text-neutral-200">
            <File size={12} />
            Novo projeto de traducao
          </span>
          <span className="flex-1" />
          <span className="flex items-center gap-2 font-mono text-[11px]">
            <span className={setup.step1Done ? 'text-amber-400' : 'text-neutral-600'}>
              1 Idiomas
            </span>
            <span className="text-neutral-700">-</span>
            <span className={setup.step2Done ? 'text-amber-400' : 'text-neutral-600'}>2 Mod</span>
            <span className="text-neutral-700">-</span>
            <span className={setup.step3Done ? 'text-amber-400' : 'text-neutral-600'}>
              3 Arquivo
            </span>
          </span>
        </div>

        <div className="flex-1 overflow-y-auto icosa-scroll [scrollbar-gutter:stable] px-6 pt-7 pb-6 min-h-0">
          <div className="max-w-220 mx-auto flex flex-col gap-3.5">
            <SetupStepCard step="01">
              <div>
                <h3 className="text-[15px] font-semibold text-neutral-200 tracking-tight m-0">
                  Par de idiomas
                </h3>
                <p className="text-xs text-neutral-500 mt-1 m-0">
                  De onde para onde voce quer traduzir.
                </p>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] gap-3.5 items-end">
                <div>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500 mb-1.5">
                    Origem
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
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500 mb-1.5">
                    Destino
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

        <div className="shrink-0 px-6 py-3 border-t border-[#1f2329]">
          <div className="max-w-220 mx-auto flex items-center gap-2.5 px-4 py-3 bg-[#131518] border border-neutral-700 rounded-xl shadow-xl">
            <div className="flex-1 text-xs text-neutral-400">
              {setup.ready ? (
                <>
                  Pronto para iniciar:{' '}
                  <strong className="text-neutral-200 font-semibold">
                    {setup.srcLang?.name ?? setup.sourceLang}
                  </strong>
                  {' -> '}
                  <strong className="text-neutral-200 font-semibold">
                    {setup.tgtLang?.name ?? setup.targetLang}
                  </strong>
                </>
              ) : (
                'Complete os 3 passos para comecar a traduzir'
              )}
            </div>
            <button type="button" className={btnBase} onClick={session.resetSession}>
              Cancelar
            </button>
            <button
              type="button"
              className={cn(
                btnPrimary,
                (!setup.ready || isLoading) && 'opacity-40 cursor-not-allowed'
              )}
              disabled={!setup.ready || isLoading}
              onClick={() => importFlow.openFile(setup.filePath, setup.ready)}
            >
              {isLoading ? <Loader2 size={13} className="animate-spin" /> : null}
              Abrir editor
              {!isLoading && (
                <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded bg-neutral-950/30 border border-neutral-800 font-mono text-[10px] text-neutral-300">
                  Enter
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {importFlow.preparedImport && (
        <XmlSelectionModal
          prepared={importFlow.preparedImport}
          onCancel={importFlow.closeImportModal}
          onSelect={(candidateId) =>
            importFlow.preparedImport
              ? importFlow.completeImport(importFlow.preparedImport.importId, candidateId)
              : Promise.resolve()
          }
        />
      )}
    </>
  )
}
