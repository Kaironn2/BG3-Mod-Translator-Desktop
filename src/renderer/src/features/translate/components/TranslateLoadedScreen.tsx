import { useCallback, useEffect, useState } from 'react'
import { BatchActionBar } from '@/components/translation/BatchActionBar'
import { TranslationGrid } from '@/components/translation/TranslationGrid'
import type { Language } from '@/types'
import { useBatchTranslation } from '../hooks/useBatchTranslation'
import { useDictionarySave } from '../hooks/useDictionarySave'
import { useTranslationExport } from '../hooks/useTranslationExport'
import type { TranslationSession } from '../types'
import { EditorHeader } from './EditorHeader'
import { PackageExportModal } from './PackageExportModal'

interface TranslateLoadedScreenProps {
  session: TranslationSession
}

export function TranslateLoadedScreen({ session }: TranslateLoadedScreenProps): React.JSX.Element {
  const [viewMode, setViewMode] = useState<'side' | 'stacked'>('side')
  const [focusMode, setFocusMode] = useState(false)
  const [languages, setLanguages] = useState<Language[]>([])
  const dictionarySave = useDictionarySave(session)
  const batch = useBatchTranslation(session)
  const exportFlow = useTranslationExport(session, languages)

  const translatedCount = session.entries.filter((entry) => entry.target.trim() !== '').length
  const dictCount = session.entries.filter(
    (entry) => entry.matchType === 'mod-text' || entry.matchType === 'text'
  ).length
  const total = session.entries.length
  const untranslatedCount = total - translatedCount
  const pct = total > 0 ? (translatedCount / total) * 100 : 0
  const fileName = session.inputPath
    ? (session.inputPath.split(/[\\/]/).pop() ?? session.modName)
    : session.modName || 'arquivo.xml'

  useEffect(() => {
    window.api.language.getAll().then(setLanguages)
  }, [])

  const handleEntryManualEdit = useCallback(
    (rowId: string) => {
      session.markManual(rowId)
    },
    [session]
  )

  return (
    <div className="flex flex-col h-full min-h-0">
      <EditorHeader
        session={session}
        fileName={fileName}
        viewMode={viewMode}
        focusMode={focusMode}
        isSaving={dictionarySave.isSaving}
        translatedCount={translatedCount}
        dictCount={dictCount}
        untranslatedCount={untranslatedCount}
        total={total}
        pct={pct}
        batchCompleted={batch.batchCompleted}
        batchTotal={batch.batchTotal}
        exportFormat={exportFlow.exportFormat}
        onViewModeChange={setViewMode}
        onFocusModeChange={setFocusMode}
        onSave={dictionarySave.saveAll}
        onExportFormatChange={exportFlow.setExportFormat}
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
        selectedCount={session.selectedUids.size}
        batchCompleted={batch.batchCompleted}
        batchTotal={batch.batchTotal}
        onTranslateDeepL={() => batch.batchTranslate('deepl')}
        onTranslateGPT={() => batch.batchTranslate('openai')}
        onCancelTranslation={batch.cancelBatch}
        onClearSelection={session.clearSelection}
        isTranslating={batch.isBatchTranslating}
      />

      {exportFlow.exportMeta && (
        <PackageExportModal
          meta={exportFlow.exportMeta}
          languages={languages}
          selectedLanguageFolder={exportFlow.bg3LanguageFolder}
          isExporting={exportFlow.isExporting}
          onCancel={exportFlow.closeExportModal}
          onSubmit={exportFlow.submitPackageExport}
        />
      )}
    </div>
  )
}
