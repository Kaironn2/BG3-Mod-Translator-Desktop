import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { ModalShell } from '@/components/shared/ModalShell'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { MetricsService, MetricsUsage } from '@/types'

interface UsageEditDialogProps {
  open: boolean
  service: MetricsService
  usage: MetricsUsage
  onSave: (data: { charLimit: number; consumedChars: number; renewalAt: string }) => void
  onClose: () => void
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Convert ISO UTC string to local datetime-local input value (YYYY-MM-DDTHH:MM)
function isoToLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

export function UsageEditDialog({
  open,
  service,
  usage,
  onSave,
  onClose
}: UsageEditDialogProps): React.JSX.Element | null {
  const { t } = useAppTranslation('metrics')
  const serviceName = capitalize(service)

  const [limitDraft, setLimitDraft] = useState(String(usage.charLimit))
  const [consumedDraft, setConsumedDraft] = useState(String(usage.consumedChars))
  const [renewalDraft, setRenewalDraft] = useState(isoToLocalInput(usage.renewalAt))
  const [errors, setErrors] = useState<{ limit?: string; consumed?: string; renewal?: string }>({})

  const validate = (): boolean => {
    const next: typeof errors = {}
    const limit = Number(limitDraft)
    const consumed = Number(consumedDraft)

    if (!limitDraft || Number.isNaN(limit) || limit <= 0) {
      next.limit = t('usage.editDialog.invalidNumber')
    }
    if (consumedDraft === '' || Number.isNaN(consumed) || consumed < 0) {
      next.consumed = t('usage.editDialog.invalidNumber')
    }
    if (!renewalDraft) {
      next.renewal = t('usage.editDialog.invalidDate')
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSave = () => {
    if (!validate()) return
    onSave({
      charLimit: Number(limitDraft),
      consumedChars: Number(consumedDraft),
      renewalAt: new Date(renewalDraft).toISOString()
    })
  }

  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        className="rounded-md border border-neutral-700/50 bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-700 transition-colors"
      >
        {t('usage.editDialog.cancel')}
      </button>
      <button
        type="button"
        onClick={handleSave}
        className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:bg-amber-400 transition-colors"
      >
        {t('usage.editDialog.save')}
      </button>
    </>
  )

  return (
    <ModalShell
      open={open}
      title={t('usage.editDialog.title', { service: serviceName })}
      icon={<Pencil size={16} />}
      sizeClassName="max-w-md"
      onClose={onClose}
      footer={footer}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-char-limit" className="text-xs font-medium text-neutral-300">
            {t('usage.editDialog.limitLabel')}
          </label>
          <input
            id="edit-char-limit"
            type="number"
            min={1}
            value={limitDraft}
            onChange={(e) => {
              setLimitDraft(e.target.value)
              setErrors((prev) => ({ ...prev, limit: undefined }))
            }}
            className="rounded-md border border-neutral-800 bg-[#0a0a0c] px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 focus:outline-none transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          {errors.limit && <p className="text-xs text-red-400">{errors.limit}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-consumed-chars" className="text-xs font-medium text-neutral-300">
            {t('usage.editDialog.consumedLabel')}
          </label>
          <input
            id="edit-consumed-chars"
            type="number"
            min={0}
            value={consumedDraft}
            onChange={(e) => {
              setConsumedDraft(e.target.value)
              setErrors((prev) => ({ ...prev, consumed: undefined }))
            }}
            className="rounded-md border border-neutral-800 bg-[#0a0a0c] px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 focus:outline-none transition-all [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          {errors.consumed && <p className="text-xs text-red-400">{errors.consumed}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-renewal-at" className="text-xs font-medium text-neutral-300">
            {t('usage.editDialog.renewalLabel')}
          </label>
          <input
            id="edit-renewal-at"
            type="datetime-local"
            value={renewalDraft}
            onChange={(e) => {
              setRenewalDraft(e.target.value)
              setErrors((prev) => ({ ...prev, renewal: undefined }))
            }}
            className="rounded-md border border-neutral-800 bg-[#0a0a0c] px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 focus:outline-none transition-all [color-scheme:dark]"
          />
          {errors.renewal && <p className="text-xs text-red-400">{errors.renewal}</p>}
        </div>
      </div>
    </ModalShell>
  )
}
