import { Loader2 } from 'lucide-react'

interface BatchActionBarProps {
  selectedCount: number
  onTranslateDeepL: () => void
  onTranslateGPT: () => void
  onClearSelection: () => void
  isTranslating: boolean
}

export function BatchActionBar({
  selectedCount,
  onTranslateDeepL,
  onTranslateGPT,
  onClearSelection,
  isTranslating
}: BatchActionBarProps): React.JSX.Element | null {
  if (selectedCount === 0) return null

  return (
    <div className="flex items-center gap-3 border-t border-neutral-700 bg-neutral-900 px-4 py-3 shrink-0">
      <span className="text-sm text-neutral-400 shrink-0">
        {selectedCount} {selectedCount === 1 ? 'entrada selecionada' : 'entradas selecionadas'}
      </span>

      {isTranslating ? (
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <Loader2 size={14} className="animate-spin" />
          Traduzindo...
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={onTranslateDeepL}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Traduzir via DeepL
          </button>
          <button
            type="button"
            onClick={onTranslateGPT}
            className="rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-600"
          >
            Traduzir via GPT
          </button>
        </>
      )}

      <button
        type="button"
        onClick={onClearSelection}
        disabled={isTranslating}
        className="ml-auto text-xs text-neutral-500 hover:text-neutral-300 transition-colors disabled:opacity-50"
      >
        Limpar seleção
      </button>
    </div>
  )
}
