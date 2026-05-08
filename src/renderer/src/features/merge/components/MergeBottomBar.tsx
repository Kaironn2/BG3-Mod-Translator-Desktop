import { Loader2, Merge } from 'lucide-react'
import { useAppTranslation } from '@/i18n/useAppTranslation'
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
  const { t } = useAppTranslation(['merge', 'common'])

  return (
    <div className="shrink-0 border-t border-[#1f2329] px-6 py-3">
      <div className="mx-auto flex max-w-220 items-center gap-2.5 rounded-xl border border-neutral-700 bg-[#131518] px-4 py-3 shadow-xl">
        <div className="flex-1 text-xs text-neutral-400">
          {ready ? t('bottomBar.ready', { ns: 'merge' }) : t('bottomBar.idle', { ns: 'merge' })}
        </div>
        <button type="button" className={btnBase} onClick={onCancel} disabled={isRunning}>
          {t('actions.cancel', { ns: 'common' })}
        </button>
        <button
          type="button"
          className={cn(btnPrimary, (!ready || isRunning) && 'cursor-not-allowed opacity-40')}
          disabled={!ready || isRunning}
          onClick={onRun}
        >
          {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Merge size={13} />}
          {isRunning ? t('bottomBar.running', { ns: 'merge' }) : t('actions.run', { ns: 'common' })}
        </button>
      </div>
    </div>
  )
}
