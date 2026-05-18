import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { MetricsUsage } from '@/types'

interface UsageCardProps {
  usage: MetricsUsage
  onEdit: () => void
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function UsageCard({ usage, onEdit }: UsageCardProps): React.JSX.Element {
  const { t } = useAppTranslation('metrics')

  const { service, consumedChars, charLimit, renewalAt } = usage
  const pct = charLimit > 0 ? Math.min(100, (consumedChars / charLimit) * 100) : 0
  const remaining = Math.max(0, charLimit - consumedChars)
  const isOverLimit = consumedChars >= charLimit
  const serviceName = capitalize(service)
  const renewsOnFormatted = new Date(renewalAt).toLocaleDateString()

  return (
    <div className="flex-1 bg-[#141416] border border-neutral-800/80 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-800/50 flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-200">
          {t('usage.card.title', { service: serviceName })}
        </h2>
        {isOverLimit && (
          <span className="rounded-full bg-red-500/15 border border-red-500/30 px-2 py-0.5 text-xs font-medium text-red-400">
            Limit reached
          </span>
        )}
      </div>
      <div className="p-6 flex flex-col gap-4">
        <div className="text-2xl font-semibold text-neutral-100 tabular-nums">
          {t('usage.card.consumedOfLimit', {
            consumed: consumedChars.toLocaleString(),
            limit: charLimit.toLocaleString()
          })}
        </div>

        <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isOverLimit ? 'bg-red-500' : 'bg-amber-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-neutral-400">
          <span>{t('usage.card.remaining', { remaining: remaining.toLocaleString() })}</span>
          <span>{t('usage.card.renewsOn', { date: renewsOnFormatted })}</span>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onEdit}
            className="text-xs font-medium text-amber-500 hover:text-amber-400 transition-colors"
          >
            {t('usage.card.editButton')}
          </button>
        </div>
      </div>
    </div>
  )
}
