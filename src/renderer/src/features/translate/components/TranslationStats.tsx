interface TranslationStatsProps {
  translatedCount: number
  total: number
  pct: number
}

export function TranslationStats({
  translatedCount,
  total,
  pct
}: TranslationStatsProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2 min-w-70">
      <div className="flex items-baseline gap-1 justify-end font-mono">
        <span className="text-[28px] font-bold text-amber-400 leading-none tracking-tight">
          {translatedCount}
        </span>
        <span className="text-base text-neutral-500">/{total}</span>
      </div>
      <div className="relative h-1.5 bg-[#131518] rounded overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-amber-400 rounded transition-all duration-240"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, transparent, transparent calc(2.5% - 1px), #0f1114 calc(2.5% - 1px), #0f1114 2.5%)'
          }}
        />
      </div>
      <div className="font-mono text-[11px] text-neutral-500 text-right tabular-nums">
        {pct.toFixed(2)}%
      </div>
    </div>
  )
}
