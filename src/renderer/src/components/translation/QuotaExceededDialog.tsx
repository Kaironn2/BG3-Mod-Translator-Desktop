import { AlertTriangle } from 'lucide-react'
import { ModalShell } from '@/components/shared/ModalShell'
import { useAppTranslation } from '@/i18n/useAppTranslation'

interface QuotaExceededDialogProps {
  open: boolean
  service: string
  remaining: number
  requested: number
  allowedEntries?: number
  totalEntries?: number
  renewalAt?: string
  onConfirmPartial?: () => void
  onClose: () => void
}

export function QuotaExceededDialog({
  open,
  service,
  remaining,
  requested,
  allowedEntries,
  totalEntries,
  renewalAt,
  onConfirmPartial,
  onClose
}: QuotaExceededDialogProps): React.JSX.Element | null {
  const { t } = useAppTranslation('metrics')

  const hasPartialOption = allowedEntries != null && allowedEntries > 0

  return (
    <ModalShell
      open={open}
      title={t('quotaModal.title', { service })}
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
            {t('quotaModal.dismiss')}
          </button>
          {hasPartialOption && onConfirmPartial && (
            <button
              type="button"
              onClick={onConfirmPartial}
              className="inline-flex h-8 cursor-pointer items-center rounded-md border border-amber-500 bg-amber-500 px-3 text-xs font-semibold text-neutral-950 transition-colors hover:border-amber-400 hover:bg-amber-400"
            >
              {t('quotaModal.confirm')}
            </button>
          )}
        </>
      }
    >
      <p className="text-sm leading-6 text-neutral-300">
        {hasPartialOption
          ? t('quotaModal.body', { requested, remaining, allowedEntries, totalEntries })
          : t('quotaModal.fullBlockBody', { service, renewalAt: renewalAt ?? '' })}
      </p>
    </ModalShell>
  )
}
