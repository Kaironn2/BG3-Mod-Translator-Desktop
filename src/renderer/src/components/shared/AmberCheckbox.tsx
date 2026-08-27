import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

interface AmberCheckboxProps {
  checked: boolean
  indeterminate?: boolean
  disabled?: boolean
  title?: string
  className?: string
  onChange: (checked: boolean) => void
}

export function AmberCheckbox({
  checked,
  indeterminate = false,
  disabled,
  title,
  className,
  onChange
}: AmberCheckboxProps): React.JSX.Element {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked
  }, [checked, indeterminate])

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      title={title}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.target.checked)}
      className={cn(
        'h-4 w-4 shrink-0 cursor-pointer accent-amber-500 disabled:cursor-not-allowed disabled:opacity-40',
        className
      )}
    />
  )
}
