import { useCallback, useEffect, useState } from 'react'
import { AlreadyTranslatedDialog } from '@/components/translation/AlreadyTranslatedDialog'
import { BatchActionBar } from '@/components/translation/BatchActionBar'
import { QuotaExceededDialog } from '@/components/translation/QuotaExceededDialog'
import { TranslationGrid } from '@/components/translation/TranslationGrid'
import { AI_PROVIDERS } from '@/features/settings/aiProviders'
import { useAISettings } from '@/hooks/useAISettings'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { Language } from '@/types'
import { useBatchTranslation } from '../hooks/useBatchTranslation'
import { useDictionarySave } from '../hooks/useDictionarySave'
import { useLoadedEditorShortcuts } from '../hooks/useLoadedEditorShortcuts'
import { useTranslationExport } from '../hooks/useTranslationExport'
import type { TranslationSession } from '../types'
import { languageToBg3Folder } from '../utils/exportNames'
import { EditorHeader } from './EditorHeader'
import { PackageExportModal } from './PackageExportModal'

interface TranslateLoadedScreenProps {
  session: TranslationSession
}

export function TranslateLoadedScreen({ session }: TranslateLoadedScreenProps): React.JSX.Element {
  const { t } = useAppTranslation('translate')
  const [viewMode, setViewMode] = useState<'side' | 'stacked'>('side')
  const [languages, setLanguages] = useState<Language[]>([])
  const dictionarySave = useDictionarySave(session)
  const batch = useBatchTranslation(session)
  const exportFlow = useTranslationExport(session, languages)
  const { provider: aiProvider, keyFor } = useAISettings()

  const translatedCount = session.entries.filter((entry) => entry.target.trim() !== '').length
  const dictCount = session.entries.filter(
    (entry) => entry.matchType === 'mod-text' || entry.matchType === 'text'
  ).length
  const total = session.entries.length
  const untranslatedCount = total - translatedCount
  const pct = total > 0 ? (translatedCount / total) * 100 : 0
  const fileName = session.inputPath
    ? (session.inputPath.split(/[\\/]/).pop() ?? session.modName)
    : session.modName || t('loaded.defaultFileName')

  useEffect(() => {
    window.api.language.getAll().then(setLanguages)
  }, [])

  const handleEntryManualEdit = useCallback(
    (rowId: string) => {
      session.markManual(rowId)
    },
    [session]
  )

  useLoadedEditorShortcuts({
    onSave: dictionarySave.saveAll,
    onOpenExport: exportFlow.openExport
  })

  // Default BG3 export language comes from Settings (default_export_language); the
  // session value (derived from the target language) wins when set.
  const [defaultExportFolder, setDefaultExportFolder] = useState('')
  useEffect(() => {
    window.api.config.get({ key: 'default_export_language' }).then((row) => {
      const code = row.value?.trim()
      if (!code) return
      setDefaultExportFolder(
        languageToBg3Folder(
          languages.find((item) => item.code === code),
          code
        )
      )
    })
  }, [languages])

  return (
    <div className="flex flex-col h-full min-h-0">
      <EditorHeader
        session={session}
        fileName={fileName}
        viewMode={viewMode}
        isSaving={dictionarySave.isSaving}
        translatedCount={translatedCount}
        dictCount={dictCount}
        untranslatedCount={untranslatedCount}
        total={total}
        pct={pct}
        batchCompleted={batch.batchCompleted}
        batchTotal={batch.batchTotal}
        onViewModeChange={setViewMode}
        onSave={dictionarySave.saveAll}
        onExport={exportFlow.openExport}
      />

      <div className="flex-1 min-h-0">
        <TranslationGrid
          entries={session.entries}
          onEntryChange={session.updateEntry}
          onEntryManualEdit={handleEntryManualEdit}
          onEntrySave={dictionarySave.saveEntry}
          viewMode={viewMode}
        />
      </div>

      <BatchActionBar
        selectedCount={session.selectedCount}
        batchCompleted={batch.batchCompleted}
        batchTotal={batch.batchTotal}
        waiting={batch.waiting}
        onTranslateDeepL={() => batch.batchTranslate('deepl')}
        onTranslateGoogle={() => batch.batchTranslate('google')}
        onTranslateAI={(providerId) => batch.batchTranslate(providerId)}
        aiProviders={AI_PROVIDERS.map((meta) => ({
          id: meta.id,
          name: meta.name,
          hasKey: keyFor(meta.id).trim().length > 0
        }))}
        activeAiProvider={aiProvider}
        onCancelTranslation={batch.cancelBatch}
        onClearSelection={session.clearSelection}
        isTranslating={batch.isBatchTranslating}
      />

      <AlreadyTranslatedDialog
        open={batch.pendingDecision}
        translatedCount={batch.pendingTranslatedCount}
        untranslatedCount={batch.pendingUntranslatedCount}
        onProceedAll={batch.confirmProceedAll}
        onSendOnlyUntranslated={batch.confirmSendOnlyUntranslated}
        onClose={batch.cancelPending}
      />

      {exportFlow.exportMeta && (
        <PackageExportModal
          meta={exportFlow.exportMeta}
          languages={languages}
          selectedLanguageFolder={
            exportFlow.bg3LanguageFolder || defaultExportFolder || exportFlow.bg3LanguageFolder
          }
          isExporting={exportFlow.isExporting}
          tipText={t('exportModal.languageTip', { ns: 'translate' })}
          onCancel={exportFlow.closeExportModal}
          onSubmit={exportFlow.submitExport}
        />
      )}

      <QuotaExceededDialog
        open={batch.quotaExceeded !== null}
        service={batch.quotaExceeded?.service ?? ''}
        remaining={batch.quotaExceeded?.remaining ?? 0}
        requested={batch.quotaExceeded?.requested ?? 0}
        allowedEntries={batch.quotaExceeded?.allowedEntries}
        totalEntries={batch.quotaExceeded?.totalEntries}
        renewalAt={batch.quotaExceeded?.renewalAt}
        onConfirmPartial={
          batch.quotaExceeded && batch.quotaExceeded.allowedEntries > 0
            ? batch.confirmPartialBatch
            : undefined
        }
        onClose={batch.dismissQuotaExceeded}
      />
    </div>
  )
}
