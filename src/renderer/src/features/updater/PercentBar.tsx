import { cn } from '@/lib/utils'

export function PercentBar({
  percent,
  label,
  className
}: {
  percent: number
  label?: string
  className?: string
}): React.JSX.Element {
  const pct = Math.max(0, Math.min(100, Math.round(percent)))

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex justify-between gap-2 text-xs text-neutral-400">
        <span className="truncate">{label}</span>
        <span className="shrink-0">{pct}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
        <div
          className="h-full rounded-full bg-amber-500 transition-all duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
