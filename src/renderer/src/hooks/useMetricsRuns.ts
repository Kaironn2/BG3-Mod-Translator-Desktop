import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { MetricsDailyBucket, MetricsModBucket, MetricsRun, MetricsRunService } from '@/types'

interface MetricsRunsInputs {
  from: string
  to: string
  service?: MetricsRunService
}

interface MetricsRunsState {
  runs: MetricsRun[]
  daily: MetricsDailyBucket[]
  byMod: MetricsModBucket[]
  loading: boolean
  error: string | null
}

export function useMetricsRuns({ from, to, service }: MetricsRunsInputs) {
  const { t } = useAppTranslation('metrics')
  const [state, setState] = useState<MetricsRunsState>({
    runs: [],
    daily: [],
    byMod: [],
    loading: true,
    error: null
  })

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const [runs, daily, byMod] = await Promise.all([
        window.api.metrics.listRuns({ from, to, service }),
        window.api.metrics.aggregateByDay({ from, to, service }),
        window.api.metrics.aggregateByMod({ from, to, service })
      ])
      setState({ runs, daily, byMod, loading: false, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setState((prev) => ({ ...prev, loading: false, error: message }))
      toast.error(t('errors.loadFailed'))
    }
  }, [from, to, service, t])

  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    runs: state.runs,
    daily: state.daily,
    byMod: state.byMod,
    loading: state.loading,
    error: state.error,
    refresh
  }
}
