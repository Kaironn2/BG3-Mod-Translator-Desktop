import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  Columns2,
  Focus,
  Loader2,
  Redo2,
  Rows2,
  Save,
  Undo2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ExportFormat, TranslationSession } from '../types'
import { ExportControls } from './ExportControls'
import { btnBase, btnGhostIcon, btnPrimary } from './styles'
import { TranslationStats } from './TranslationStats'

interface EditorHeaderProps {
  session: TranslationSession
  fileName: string
  viewMode: 'side' | 'stacked'
  focusMode: boolean
  isSaving: boolean
  translatedCount: number
  dictCount: number
  untranslatedCount: number
  total: number
  pct: number
  exportFormat: ExportFormat
  onViewModeChange: (mode: 'side' | 'stacked') => void
  onFocusModeChange: (value: boolean) => void
  onSave: () => Promise<void>
  onExportFormatChange: (format: ExportFormat) => void
  onExport: () => Promise<void>
}

export function EditorHeader({
  session,
  fileName,
  viewMode,
  focusMode,
  isSaving,
  translatedCount,
  dictCount,
  untranslatedCount,
  total,
  pct,
  exportFormat,
  onViewModeChange,
  onFocusModeChange,
  onSave,
  onExportFormatChange,
  onExport
}: EditorHeaderProps): React.JSX.Element {
  return (
    <div className="bg-[#0f1114] border-b border-[#1f2329] px-7 pt-5 pb-4 shrink-0">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2 text-sm text-neutral-500 min-w-0">
          <input
            value={session.modName}
            onChange={(event) => session.setModName(event.target.value)}
            placeholder="Nome do mod"
            className="bg-transparent text-neutral-300 font-medium text-sm focus:outline-none placeholder:text-neutral-600 min-w-0 max-w-50"
          />
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
            onClick={() => onFocusModeChange(!focusMode)}
            className={cn(focusMode ? btnPrimary : btnBase)}
          >
            <Focus />
            Modo foco
            <span className="inline-flex items-center justify-center h-4.5 min-w-4.5 px-1 rounded bg-[#1f2329] border border-[#1f2329] border-b-2 font-mono text-[10px] text-neutral-400">
              F
            </span>
          </button>

          <button type="button" className={btnBase} onClick={session.resetSession}>
            <ArrowLeft />
            Voltar
          </button>

          <button
            type="button"
            className={cn(btnBase, isSaving && 'opacity-60 cursor-not-allowed')}
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save />}
            Salvar
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

        <TranslationStats translatedCount={translatedCount} total={total} pct={pct} />
      </div>
    </div>
  )
}
