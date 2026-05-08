import { Loader2 } from 'lucide-react'

interface BatchActionBarProps {
  selectedCount: number
  batchCompleted: number
  batchTotal: number
  onTranslateDeepL: () => void
  // onTranslateGPT: () => void
  onCancelTranslation: () => void
  onClearSelection: () => void
  isTranslating: boolean
}

export function BatchActionBar({
  selectedCount,
  batchCompleted,
  batchTotal,
  onTranslateDeepL,
  // onTranslateGPT,
  onCancelTranslation,
  onClearSelection,
  isTranslating
}: BatchActionBarProps): React.JSX.Element | null {
  if (selectedCount === 0 && !isTranslating) return null

  return (
    <div className="flex shrink-0 items-center gap-3 border-t border-neutral-700 bg-neutral-900 px-4 py-3">
      <span className="shrink-0 text-sm text-neutral-400">
        {selectedCount}{' '}
        {selectedCount === 1 ? 'entrada selecionada' : 'entradas selecionadas'}
      </span>

      {isTranslating ? (
        <>
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <Loader2 size={14} className="animate-spin" />
            Traduzindo {batchCompleted} / {batchTotal || selectedCount}
          </div>
          <button
            type="button"
            onClick={onCancelTranslation}
            className="cursor-pointer rounded-md border border-red-500/60 px-3 py-1.5 text-sm font-medium text-red-200 transition-colors hover:bg-red-500/10"
          >
            Parar
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={onTranslateDeepL}
            className="cursor-pointer rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Traduzir via DeepL
          </button>
          {/* <button
            type="button"
            onClick={onTranslateGPT}
            className="cursor-pointer rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-600"
          >
            Traduzir via GPT
          </button> */}
        </>
      )}

      <button
        type="button"
        onClick={onClearSelection}
        disabled={isTranslating}
        className="ml-auto cursor-pointer text-xs text-neutral-500 transition-colors hover:text-neutral-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Limpar selecao
      </button>
    </div>
  )
}
