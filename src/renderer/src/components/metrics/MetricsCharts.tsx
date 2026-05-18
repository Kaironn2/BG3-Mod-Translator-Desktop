import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { MetricsDailyBucket, MetricsModBucket } from '@/types'

interface MetricsChartsProps {
  daily: MetricsDailyBucket[]
  byMod: MetricsModBucket[]
  from: string
  to: string
  loading: boolean
}

// Generate all ISO date strings (YYYY-MM-DD) in [from, to] inclusive
function buildDateRange(from: string, to: string): string[] {
  const dates: string[] = []
  const cur = new Date(from)
  const end = new Date(to)
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

// Merge daily data with gap-filled zero rows
function fillDailyGaps(
  daily: MetricsDailyBucket[],
  from: string,
  to: string
): MetricsDailyBucket[] {
  const map = new Map<string, MetricsDailyBucket>()
  for (const row of daily) {
    map.set(row.date, row)
  }
  return buildDateRange(from, to).map(
    (date) => map.get(date) ?? { date, entries: 0, chars: 0, runs: 0 }
  )
}

const CHART_TOOLTIP_STYLE = {
  backgroundColor: '#131518',
  border: '1px solid #1f2329',
  borderRadius: 8,
  fontSize: 12,
  color: '#d4d4d8'
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#141416] border border-neutral-800/80 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-neutral-800/50">
        <h3 className="text-sm font-medium text-neutral-200">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

export function MetricsCharts({
  daily,
  byMod,
  from,
  to,
  loading
}: MetricsChartsProps): React.JSX.Element {
  const { t } = useAppTranslation('metrics')

  const filledDaily = useMemo(() => fillDailyGaps(daily, from, to), [daily, from, to])

  const hasData = daily.length > 0 || byMod.length > 0

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-[#141416] border border-neutral-800/80 rounded-xl h-48 animate-pulse"
          />
        ))}
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className="bg-[#141416] border border-neutral-800/80 rounded-xl p-12 text-center">
        <p className="text-sm text-neutral-500">{t('runs.empty')}</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard title={t('charts.dailyChars.title')}>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={filledDaily} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2329" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#71717a' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: string) => v.slice(5)}
            />
            <YAxis tick={{ fontSize: 10, fill: '#71717a' }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ stroke: '#303641' }} />
            <Line
              type="monotone"
              dataKey="chars"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#f59e0b' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={t('charts.dailyEntries.title')}>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={filledDaily} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2329" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#71717a' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: string) => v.slice(5)}
            />
            <YAxis tick={{ fontSize: 10, fill: '#71717a' }} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ stroke: '#303641' }} />
            <Line
              type="monotone"
              dataKey="entries"
              stroke="#a78bfa"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#a78bfa' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="lg:col-span-2">
        <ChartCard title={t('charts.modsTranslated.title')}>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={byMod}
              margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2329" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: '#71717a' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="modName"
                tick={{ fontSize: 10, fill: '#71717a' }}
                tickLine={false}
                axisLine={false}
                width={100}
                tickFormatter={(v: string | null) => v ?? '(unknown)'}
              />
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: '#1f2329' }} />
              <Bar dataKey="entries" fill="#f59e0b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
