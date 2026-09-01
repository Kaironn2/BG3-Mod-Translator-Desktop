import type { ReactNode } from 'react'
import { btnPrimary } from '@/features/translate/components/styles'
import { cn } from '@/lib/utils'

export interface ActionBarStatus {
  kind: 'success' | 'error'
  text: string
}

interface ActionBottomBarProps {
  ready: boolean
  running: boolean
  icon: ReactNode
  buttonLabel: string
  runningLabel: string
  idleLabel: string
  readyLabel: string
  status?: ActionBarStatus | null
  onRun: () => void
}

export function ActionBottomBar({
  ready,
  running,
  icon,
  buttonLabel,
  runningLabel,
  idleLabel,
  readyLabel,
  status = null,
  onRun
}: ActionBottomBarProps): React.JSX.Element {
  return (
    <div className="shrink-0 border-t border-[#1f2329] px-6 py-3">
      <div className="mx-auto flex max-w-220 flex-col gap-2 rounded-xl border border-neutral-700 bg-[#131518] px-4 py-3 shadow-xl">
        {running && <div className="h-2 animate-pulse rounded-full bg-amber-400/30" />}
        <div className="flex items-center gap-2.5">
          <div className="min-w-0 flex-1 truncate text-xs text-neutral-400">
            {running ? (
              runningLabel
            ) : status ? (
              <span
                className={cn(
                  'font-mono text-[11px]',
                  status.kind === 'success' ? 'text-amber-400' : 'text-red-400'
                )}
                title={status.text}
              >
                {status.text}
              </span>
            ) : ready ? (
              readyLabel
            ) : (
              idleLabel
            )}
          </div>
          <button
            type="button"
            className={cn(btnPrimary, (!ready || running) && 'cursor-not-allowed opacity-40')}
            disabled={!ready || running}
            onClick={onRun}
          >
            {icon}
            {running ? runningLabel : buttonLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
