import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface ModalShellProps {
  open: boolean
  title: string
  description?: string
  icon?: ReactNode
  sizeClassName?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}

export function ModalShell({
  open,
  title,
  description,
  icon,
  sizeClassName = 'max-w-3xl',
  onClose,
  children,
  footer
}: ModalShellProps): React.JSX.Element | null {
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'w-full overflow-hidden rounded-xl border border-[#303641] bg-[#131518] shadow-[0_24px_80px_rgba(0,0,0,0.45)]',
          sizeClassName
        )}
      >
        <div className="flex items-start gap-3 border-b border-[#1f2329] px-5 py-4">
          {icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/12 text-amber-400">
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-neutral-100">{title}</div>
            {description && <div className="mt-1 text-xs text-neutral-500">{description}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-[#181b1f] hover:text-neutral-200"
          >
            <X size={14} />
          </button>
        </div>

        <div className="px-5 py-5">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-[#1f2329] bg-[#0f1114] px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
