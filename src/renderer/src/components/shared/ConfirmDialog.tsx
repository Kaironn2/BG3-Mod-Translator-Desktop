import { AlertTriangle } from 'lucide-react'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { ModalShell } from './ModalShell'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void | Promise<void>
  onClose: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onClose
}: ConfirmDialogProps): React.JSX.Element | null {
  const { t } = useAppTranslation('common')

  return (
    <ModalShell
      open={open}
      title={title}
      description={description}
      sizeClassName="max-w-md"
      icon={<AlertTriangle size={16} />}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 cursor-pointer items-center rounded-md border border-neutral-700 bg-[#131518] px-3 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-800"
          >
            {cancelLabel ?? t('actions.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              destructive
                ? 'inline-flex h-8 cursor-pointer items-center rounded-md border border-red-500/40 bg-red-500/10 px-3 text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/20'
                : 'inline-flex h-8 cursor-pointer items-center rounded-md border border-amber-500 bg-amber-500 px-3 text-xs font-semibold text-neutral-950 transition-colors hover:border-amber-400 hover:bg-amber-400'
            }
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm leading-6 text-neutral-300">{description}</p>
    </ModalShell>
  )
}
