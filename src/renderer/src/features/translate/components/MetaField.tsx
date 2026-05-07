import { cn } from '@/lib/utils'

interface MetaFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  hint?: string
}

export function MetaField({
  label,
  value,
  onChange,
  invalid,
  hint
}: MetaFieldProps): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'h-9 px-3 rounded-md border bg-[#0f1114] text-sm text-neutral-200 focus:outline-none placeholder:text-neutral-600',
          invalid
            ? 'border-red-500 focus:border-red-400'
            : 'border-[#1f2329] focus:border-amber-500'
        )}
      />
      {hint && (
        <span className={cn('text-[11px]', invalid ? 'text-red-300' : 'text-neutral-500')}>
          {hint}
        </span>
      )}
    </label>
  )
}
