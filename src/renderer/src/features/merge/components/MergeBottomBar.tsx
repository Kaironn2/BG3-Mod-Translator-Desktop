import { Loader2, Merge } from 'lucide-react'
import { btnBase, btnPrimary } from '@/features/translate/components/styles'
import { cn } from '@/lib/utils'

interface MergeBottomBarProps {
  ready: boolean
  isRunning: boolean
  onCancel: () => void
  onRun: () => void
}

export function MergeBottomBar({
  ready,
  isRunning,
  onCancel,
  onRun
}: MergeBottomBarProps): React.JSX.Element {
  return (
    <div className="shrink-0 px-6 py-3 border-t border-[#1f2329]">
      <div className="max-w-220 mx-auto flex items-center gap-2.5 px-4 py-3 bg-[#131518] border border-neutral-700 rounded-xl shadow-xl">
        <div className="flex-1 text-xs text-neutral-400">
          {ready
            ? 'Pronto para fundir as entradas casadas no dicionario'
            : 'Complete os 3 passos para iniciar a fusao'}
        </div>
        <button type="button" className={btnBase} onClick={onCancel} disabled={isRunning}>
          Cancelar
        </button>
        <button
          type="button"
          className={cn(btnPrimary, (!ready || isRunning) && 'opacity-40 cursor-not-allowed')}
          disabled={!ready || isRunning}
          onClick={onRun}
        >
          {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Merge size={13} />}
          Fundir e salvar
        </button>
      </div>
    </div>
  )
}
