import { Lock } from 'lucide-react'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { cn } from '@/lib/utils'

interface PathInputRowProps {
  label: string
  value: string
  placeholder: string
  onBrowse: () => void | Promise<void>
  disabled?: boolean
  locked?: boolean
  className?: string
}

export function PathInputRow({
  label,
  value,
  placeholder,
  onBrowse,
  disabled = false,
  locked = false,
  className
}: PathInputRowProps): React.JSX.Element {
  const { t } = useAppTranslation('common')

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <span className="text-[13px] font-medium text-neutral-400">{label}</span>
      <div className="flex gap-2.5">
        <div
          className={cn(
            'flex h-[42px] min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#2a2a2a] bg-[#121212] px-3.5',
            locked && 'opacity-70'
          )}
        >
          {locked && <Lock size={13} className="shrink-0 text-neutral-500" />}
          <span
            className={cn(
              'min-w-0 flex-1 truncate font-mono text-[13px]',
              value ? 'text-neutral-200' : 'text-neutral-600'
            )}
            title={value || undefined}
          >
            {value || placeholder}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void onBrowse()}
          disabled={disabled || locked}
          className="h-[42px] shrink-0 cursor-pointer rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4.5 text-[13px] font-medium text-neutral-400 transition-colors hover:border-[#444] hover:bg-[#222] hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('actions.browse')}
        </button>
      </div>
    </div>
  )
}
