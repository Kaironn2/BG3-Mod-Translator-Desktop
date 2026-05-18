import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { MetricsService, MetricsUsage } from '@/types'

interface MetricsUsageState {
  deepl: MetricsUsage | null
  google: MetricsUsage | null
  loading: boolean
  error: string | null
}

export function useMetricsUsage() {
  const { t } = useAppTranslation('metrics')
  const [state, setState] = useState<MetricsUsageState>({
    deepl: null,
    google: null,
    loading: true,
    error: null
  })

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const all = await window.api.metrics.getAllUsage()
      const deepl = all.find((u) => u.service === 'deepl') ?? null
      const google = all.find((u) => u.service === 'google') ?? null
      setState({ deepl, google, loading: false, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setState((prev) => ({ ...prev, loading: false, error: message }))
      toast.error(t('errors.loadFailed'))
    }
  }, [t])

  useEffect(() => {
    refresh()
  }, [refresh])

  const setLimit = useCallback(
    async (service: MetricsService, charLimit: number) => {
      await window.api.metrics.setLimit({ service, charLimit })
      await refresh()
    },
    [refresh]
  )

  const setRenewalAt = useCallback(
    async (service: MetricsService, isoUtc: string) => {
      await window.api.metrics.setRenewalAt({ service, renewalAt: isoUtc })
      await refresh()
    },
    [refresh]
  )

  const setConsumed = useCallback(
    async (service: MetricsService, n: number) => {
      await window.api.metrics.setConsumed({ service, consumedChars: n })
      await refresh()
    },
    [refresh]
  )

  return {
    deepl: state.deepl,
    google: state.google,
    loading: state.loading,
    error: state.error,
    refresh,
    setLimit,
    setRenewalAt,
    setConsumed
  }
}
