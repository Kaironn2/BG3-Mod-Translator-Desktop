import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Columns2,
  Loader2,
  Redo2,
  Rows2,
  Save,
  Undo2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ExportFormat, TranslationSession } from '../types'
import { ExportControls } from './ExportControls'
import { btnBase, btnGhostIcon } from './styles'
import { TranslationStats } from './TranslationStats'

function ShortcutHint({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <span className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded border border-[#2a2f37] border-b-2 bg-[#181b1f] px-1 font-mono text-[10px] text-neutral-400">
      {children}
    </span>
  )
}

interface EditorHeaderProps {
  session: TranslationSession
  fileName: string
  viewMode: 'side' | 'stacked'
  isSaving: boolean
  translatedCount: number
  dictCount: number
  untranslatedCount: number
  total: number
  pct: number
  batchCompleted: number
  batchTotal: number
  exportFormat: ExportFormat
  onViewModeChange: (mode: 'side' | 'stacked') => void
  onSave: () => Promise<void>
  onExportFormatChange: (format: ExportFormat) => void
  onExport: () => Promise<void>
}

export function EditorHeader({
  session,
  fileName,
  viewMode,
  isSaving,
  translatedCount,
  dictCount,
  untranslatedCount,
  total,
  pct,
  batchCompleted,
  batchTotal,
  exportFormat,
  onViewModeChange,
  onSave,
  onExportFormatChange,
  onExport
}: EditorHeaderProps): React.JSX.Element {
  return (
    <div className="bg-[#0f1114] border-b border-[#1f2329] px-7 pt-5 pb-4 shrink-0">
      <div className="flex items-center gap-3 mb-4">
        <button type="button" className={btnBase} onClick={session.resetSession}>
          <ArrowLeft />
          Voltar
        </button>

        <div className="flex items-center gap-1.5 text-sm text-neutral-500 min-w-0">
          <span className="max-w-50 truncate font-medium text-sm text-neutral-300">
            {session.modName}
          </span>
          <span className="text-neutral-700 shrink-0">
            <ChevronRight />
          </span>
          <span className="font-mono font-semibold text-neutral-200 shrink-0">{fileName}</span>
        </div>

        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <div className="flex items-center bg-[#131518] border border-[#1f2329] rounded-md p-0.75 gap-0.5">
            <button
              type="button"
              title="Lado a lado"
              onClick={() => onViewModeChange('side')}
              className={cn(
                'w-6.5 h-5.5 flex items-center justify-center rounded border-0 cursor-pointer transition-all',
                viewMode === 'side'
                  ? 'bg-[#1f2329] text-neutral-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
                  : 'bg-transparent text-neutral-500 hover:text-neutral-200'
              )}
            >
              <Columns2 />
            </button>
            <button
              type="button"
              title="Empilhado"
              onClick={() => onViewModeChange('stacked')}
              className={cn(
                'w-6.5 h-5.5 flex items-center justify-center rounded border-0 cursor-pointer transition-all',
                viewMode === 'stacked'
                  ? 'bg-[#1f2329] text-neutral-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
                  : 'bg-transparent text-neutral-500 hover:text-neutral-200'
              )}
            >
              <Rows2 />
            </button>
          </div>

          <button type="button" className={btnGhostIcon} title="Desfazer" disabled>
            <Undo2 />
          </button>
          <button type="button" className={btnGhostIcon} title="Refazer" disabled>
            <Redo2 />
          </button>

          <div className="w-px h-4.5 bg-[#1f2329] mx-1 shrink-0" />

          <button
            type="button"
            className={cn(btnBase, isSaving && 'opacity-60 cursor-not-allowed')}
            onClick={onSave}
            disabled={isSaving}
            title="Salvar no dicionario (Ctrl+S)"
          >
            {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save />}
            Salvar
            <ShortcutHint>Ctrl S</ShortcutHint>
          </button>

          <ExportControls
            exportFormat={exportFormat}
            onFormatChange={onExportFormatChange}
            onExport={onExport}
          />
        </div>
      </div>

      <div className="flex items-end gap-8">
        <div className="flex-1 min-w-0">
          <h1 className="flex items-center gap-3.5 m-0 text-[32px] font-bold tracking-tight leading-none mb-2">
            <span className="font-mono text-neutral-200 font-bold">
              {session.sourceLang.toUpperCase()}
            </span>
            <span className="text-neutral-500 inline-flex">
              <ArrowRight />
            </span>
            <span className="font-mono text-amber-400 font-bold">
              {session.targetLang.toUpperCase()}
            </span>
          </h1>
          <div className="flex items-center gap-2.5 text-[13px] text-neutral-400">
            <span>
              <strong className="text-neutral-200 font-semibold">{untranslatedCount}</strong>{' '}
              strings restantes
            </span>
            <span className="text-neutral-700">-</span>
            <span>
              <strong className="text-neutral-200 font-semibold">{dictCount}</strong> termos no
              dicionario aplicaveis
            </span>
          </div>
        </div>

        <TranslationStats
          translatedCount={translatedCount}
          total={total}
          pct={pct}
          batchCompleted={batchCompleted}
          batchTotal={batchTotal}
        />
      </div>
    </div>
  )
}
