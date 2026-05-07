import { forwardRef, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { renderSource } from '@/utils/renderSource'

interface HighlightedTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value'> {
  value: string
  containerClassName?: string
  overlayClassName?: string
}

export const HighlightedTextarea = forwardRef<HTMLTextAreaElement, HighlightedTextareaProps>(
  function HighlightedTextarea(
    {
      value,
      onChange,
      onFocus,
      onBlur,
      className,
      containerClassName,
      overlayClassName,
      placeholder,
      ...props
    },
    ref
  ) {
    const [draft, setDraft] = useState(value)
    const [focused, setFocused] = useState(false)

    useEffect(() => {
      if (!focused) setDraft(value)
    }, [value, focused])

    return (
      <div
        className={cn(
          'relative overflow-hidden rounded-md border border-[#1f2329] bg-[#131518] transition-[border-color,box-shadow] focus-within:border-amber-500/60 focus-within:shadow-[0_0_0_3px_rgba(245,158,11,0.18)]',
          containerClassName
        )}
      >
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-0 overflow-hidden px-2.5 py-2 text-[13px] leading-[1.55] text-neutral-200 whitespace-pre-wrap wrap-break-word',
            overlayClassName
          )}
        >
          {draft ? (
            renderSource(draft, { variant: 'editor' })
          ) : (
            <span className="italic text-neutral-600">{placeholder}</span>
          )}
        </div>

        <textarea
          {...props}
          ref={ref}
          value={draft}
          spellCheck={false}
          onFocus={(event) => {
            setFocused(true)
            onFocus?.(event)
          }}
          onBlur={(event) => {
            setFocused(false)
            onBlur?.(event)
          }}
          onChange={(event) => {
            setDraft(event.target.value)
            onChange?.(event)
          }}
          placeholder={placeholder}
          className={cn(
            'relative z-10 w-full resize-none bg-transparent px-2.5 py-2 text-[13px] leading-[1.55] text-transparent caret-neutral-200 placeholder:text-transparent focus:outline-none',
            className
          )}
        />
      </div>
    )
  }
)
