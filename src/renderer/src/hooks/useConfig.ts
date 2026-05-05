import { useState, useEffect, useCallback } from 'react'
import type { ConfigKey } from '@/types'

export function useConfig() {
  const [config, setConfig] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.config.getAll().then((all) => {
      setConfig(all)
      setLoading(false)
    })
  }, [])

  const set = useCallback(async (key: ConfigKey, value: string) => {
    await window.api.config.set({ key, value })
    setConfig((prev) => ({ ...prev, [key]: value }))
  }, [])

  return { config, loading, set }
}
