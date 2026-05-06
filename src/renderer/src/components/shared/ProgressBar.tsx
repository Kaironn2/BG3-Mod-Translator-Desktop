import { cn } from '@/lib/utils'

interface ProgressBarProps {
  current: number
  total: number
  className?: string
}

export function ProgressBar({ current, total, className }: ProgressBarProps): React.JSX.Element {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex justify-between text-xs text-neutral-400">
        <span>{pct}%</span>
        <span>
          {current} / {total}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
