import { BarChart2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { MetricsCharts } from '@/components/metrics/MetricsCharts'
import { RecentRunsTable } from '@/components/metrics/RecentRunsTable'
import { UsageCard } from '@/components/metrics/UsageCard'
import { UsageEditDialog } from '@/components/metrics/UsageEditDialog'
import { useMetricsRuns } from '@/hooks/useMetricsRuns'
import { useMetricsUsage } from '@/hooks/useMetricsUsage'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { MetricsService } from '@/types'

type RangeKey = '7d' | '30d' | '90d'

const RANGE_DAYS: Record<RangeKey, number> = { '7d': 7, '30d': 30, '90d': 90 }

function buildRange(days: number): { from: string; to: string } {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - (days - 1))
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10)
  }
}

export function MetricsPage(): React.JSX.Element {
  const { t } = useAppTranslation('metrics')
  const [range, setRange] = useState<RangeKey>('30d')
  const [editingService, setEditingService] = useState<MetricsService | null>(null)

  const { from, to } = buildRange(RANGE_DAYS[range])

  const usage = useMetricsUsage()
  const runsData = useMetricsRuns({ from, to })

  const handleSaveUsage = async (data: {
    charLimit: number
    consumedChars: number
    renewalAt: string
  }) => {
    if (!editingService) return
    try {
      await usage.setLimit(editingService, data.charLimit)
      await usage.setConsumed(editingService, data.consumedChars)
      await usage.setRenewalAt(editingService, data.renewalAt)
      setEditingService(null)
    } catch {
      toast.error(t('errors.saveFailed'))
    }
  }

  const rangeKeys: RangeKey[] = ['7d', '30d', '90d']
  const editingUsage = editingService !== null ? (usage[editingService] ?? null) : null

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-neutral-100 flex items-center gap-3">
            <BarChart2 className="w-6 h-6 text-amber-500" />
            {t('page.title')}
          </h1>
          <p className="text-neutral-500 text-sm mt-1">{t('page.subtitle')}</p>
        </div>

        {/* Usage cards */}
        {usage.loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="bg-[#141416] border border-neutral-800/80 rounded-xl h-44 animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-4">
            {usage.deepl && (
              <UsageCard usage={usage.deepl} onEdit={() => setEditingService('deepl')} />
            )}
            {usage.google && (
              <UsageCard usage={usage.google} onEdit={() => setEditingService('google')} />
            )}
          </div>
        )}

        {/* Date range selector */}
        <div className="flex items-center gap-1">
          {rangeKeys.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                range === key
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 border border-transparent'
              }`}
            >
              {t(`charts.range.${key}`)}
            </button>
          ))}
        </div>

        {/* Charts */}
        <MetricsCharts
          daily={runsData.daily}
          byMod={runsData.byMod}
          from={from}
          to={to}
          loading={runsData.loading}
        />

        {/* Recent runs table */}
        <RecentRunsTable runs={runsData.runs} loading={runsData.loading} />

        <div className="h-4" />
      </div>

      {/* Edit dialogs */}
      {editingService !== null && editingUsage !== null && (
        <UsageEditDialog
          open={true}
          service={editingService}
          usage={editingUsage}
          onSave={handleSaveUsage}
          onClose={() => setEditingService(null)}
        />
      )}
    </div>
  )
}
