import { CaseSensitive, Search, WholeWord, X } from 'lucide-react'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { cn } from '@/lib/utils'

interface TextSearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  matchCase: boolean
  onMatchCaseChange: (value: boolean) => void
  matchWholeWord: boolean
  onMatchWholeWordChange: (value: boolean) => void
  inputRef?: React.RefObject<HTMLInputElement | null>
  className?: string
  inputClassName?: string
}

function ToggleButton({
  active,
  label,
  onClick,
  children
}: {
  active: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      tabIndex={-1}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        'inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded transition-colors focus:outline-none',
        active
          ? 'bg-amber-500/15 text-amber-400'
          : 'text-neutral-600 hover:bg-[#1c1f24] hover:text-neutral-400'
      )}
    >
      {children}
    </button>
  )
}

// VSCode-style search box: match case (Aa) and whole word (ab) toggles live
// inside the field. Alt+C / Alt+W toggle them while the input is focused.
export function TextSearchInput({
  value,
  onChange,
  placeholder,
  matchCase,
  onMatchCaseChange,
  matchWholeWord,
  onMatchWholeWordChange,
  inputRef,
  className,
  inputClassName
}: TextSearchInputProps): React.JSX.Element {
  const { t } = useAppTranslation('common')

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    const key = event.key.toLowerCase()
    if (key === 'c') {
      event.preventDefault()
      onMatchCaseChange(!matchCase)
    } else if (key === 'w') {
      event.preventDefault()
      onMatchWholeWordChange(!matchWholeWord)
    }
  }

  return (
    <div
      className={cn(
        'flex h-8 items-center gap-2 rounded-md border border-[#1f2329] bg-[#131518] px-3 transition-colors focus-within:border-neutral-600',
        className
      )}
    >
      <Search size={13} className="shrink-0 text-neutral-500" />
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          'min-w-0 flex-1 bg-transparent text-xs font-medium text-neutral-300 placeholder:text-neutral-600 focus:outline-none',
          inputClassName
        )}
      />
      {value && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onChange('')}
          aria-label={t('actions.clear')}
          className="shrink-0 cursor-pointer text-neutral-500 transition-colors hover:text-neutral-300"
        >
          <X size={13} />
        </button>
      )}
      <div className="flex shrink-0 items-center gap-0.5 border-l border-[#1f2329] pl-1.5">
        <ToggleButton
          active={matchCase}
          label={t('searchOptions.matchCase')}
          onClick={() => onMatchCaseChange(!matchCase)}
        >
          <CaseSensitive size={14} />
        </ToggleButton>
        <ToggleButton
          active={matchWholeWord}
          label={t('searchOptions.matchWholeWord')}
          onClick={() => onMatchWholeWordChange(!matchWholeWord)}
        >
          <WholeWord size={13} />
        </ToggleButton>
      </div>
    </div>
  )
}
