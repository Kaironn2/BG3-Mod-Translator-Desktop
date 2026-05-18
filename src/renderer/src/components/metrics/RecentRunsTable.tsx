import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { MetricsRun } from '@/types'

interface RecentRunsTableProps {
  runs: MetricsRun[]
  loading: boolean
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function RecentRunsTable({ runs, loading }: RecentRunsTableProps): React.JSX.Element {
  const { t } = useAppTranslation('metrics')

  if (loading) {
    return (
      <div className="bg-[#141416] border border-neutral-800/80 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-800/50">
          <h2 className="text-sm font-medium text-neutral-200">{t('runs.section.title')}</h2>
        </div>
        <div className="p-8 flex justify-center">
          <div className="h-5 w-5 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[#141416] border border-neutral-800/80 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-800/50">
        <h2 className="text-sm font-medium text-neutral-200">{t('runs.section.title')}</h2>
      </div>

      {runs.length === 0 ? (
        <div className="p-12 text-center">
          <p className="text-sm text-neutral-500">{t('runs.empty')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800/50">
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {t('runs.column.date')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {t('runs.column.service')}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {t('runs.column.mod')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {t('runs.column.entries')}
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  {t('runs.column.chars')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {runs.map((run) => (
                <tr key={run.id} className="hover:bg-neutral-800/30 transition-colors">
                  <td className="px-6 py-3 text-xs text-neutral-400 whitespace-nowrap">
                    {new Date(run.finishedAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-xs text-neutral-300 whitespace-nowrap">
                    {capitalize(run.service)}
                  </td>
                  <td className="px-6 py-3 text-xs text-neutral-300 max-w-[160px] truncate">
                    {run.modName ?? '-'}
                  </td>
                  <td className="px-6 py-3 text-xs text-neutral-300 text-right tabular-nums whitespace-nowrap">
                    {run.entriesTranslated.toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-xs text-neutral-300 text-right tabular-nums whitespace-nowrap">
                    {run.charsConsumed.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
