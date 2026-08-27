import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { DeleteModPreview, DeleteModResult, ModWithPriority } from '@/types'

export function useManageMods() {
  const { t } = useAppTranslation('mods')
  const [mods, setMods] = useState<ModWithPriority[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    try {
      const result = await window.api.mod.listWithPriority()
      setMods(result)
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    refetch().finally(() => setLoading(false))
  }, [refetch])

  const promote = useCallback(
    async (name: string) => {
      const prioritized = mods.filter((mod) => mod.priority !== null)
      const maxPriority = prioritized.reduce((max, mod) => Math.max(max, mod.priority ?? 0), 0)
      const nextSlot = maxPriority + 1

      try {
        await window.api.mod.setPriority({ modName: name, priority: nextSlot })
        await refetch()
        toast.success(t('toast.promoted', { name }))
      } catch {
        toast.error(t('toast.deleteFailed'))
      }
    },
    [mods, refetch, t]
  )

  const demote = useCallback(
    async (name: string) => {
      try {
        await window.api.mod.setPriority({ modName: name, priority: null })
        await refetch()
        toast.success(t('toast.demoted', { name }))
      } catch {
        toast.error(t('toast.deleteFailed'))
      }
    },
    [refetch, t]
  )

  const moveUp = useCallback(
    async (name: string) => {
      const prioritized = mods
        .filter((mod) => mod.priority !== null)
        .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))

      const index = prioritized.findIndex((mod) => mod.name === name)
      if (index <= 0) return

      const swapped = [...prioritized]
      ;[swapped[index - 1], swapped[index]] = [swapped[index], swapped[index - 1]]
      const orderedNames = swapped.map((mod) => mod.name)

      try {
        await window.api.mod.reorderPriority({ orderedNames })
        await refetch()
      } catch {
        toast.error(t('toast.deleteFailed'))
      }
    },
    [mods, refetch, t]
  )

  const moveDown = useCallback(
    async (name: string) => {
      const prioritized = mods
        .filter((mod) => mod.priority !== null)
        .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))

      const index = prioritized.findIndex((mod) => mod.name === name)
      if (index < 0 || index >= prioritized.length - 1) return

      const swapped = [...prioritized]
      ;[swapped[index], swapped[index + 1]] = [swapped[index + 1], swapped[index]]
      const orderedNames = swapped.map((mod) => mod.name)

      try {
        await window.api.mod.reorderPriority({ orderedNames })
        await refetch()
      } catch {
        toast.error(t('toast.deleteFailed'))
      }
    },
    [mods, refetch, t]
  )

  const setPosition = useCallback(
    async (name: string, position: number) => {
      const prioritized = mods
        .filter((mod) => mod.priority !== null)
        .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))

      const count = prioritized.length
      if (count === 0) return

      const clamped = Math.max(1, Math.min(count, position))
      const withoutTarget = prioritized.filter((mod) => mod.name !== name)
      withoutTarget.splice(clamped - 1, 0, { name } as ModWithPriority)
      const orderedNames = withoutTarget.map((mod) => mod.name)

      try {
        await window.api.mod.reorderPriority({ orderedNames })
        await refetch()
      } catch {
        toast.error(t('toast.deleteFailed'))
      }
    },
    [mods, refetch, t]
  )

  const reorder = useCallback(
    async (orderedNames: string[], options?: { silent?: boolean }): Promise<boolean> => {
      try {
        await window.api.mod.reorderPriority({ orderedNames })
        await refetch()
        if (!options?.silent) toast.success(t('toast.reordered'))
        return true
      } catch {
        toast.error(t('toast.deleteFailed'))
        return false
      }
    },
    [refetch, t]
  )

  const deleteMod = useCallback(
    async (name: string): Promise<DeleteModResult | null> => {
      try {
        const result = await window.api.mod.delete({ modName: name })
        await refetch()
        toast.success(t('toast.deleted', { name }))
        return result
      } catch {
        toast.error(t('toast.deleteFailed'))
        return null
      }
    },
    [refetch, t]
  )

  const previewDelete = useCallback(
    async (name: string): Promise<DeleteModPreview | null> => {
      try {
        return await window.api.mod.previewDelete({ modName: name })
      } catch {
        toast.error(t('toast.deleteFailed'))
        return null
      }
    },
    [t]
  )

  return {
    mods,
    loading,
    error,
    refetch,
    promote,
    demote,
    moveUp,
    moveDown,
    setPosition,
    reorder,
    deleteMod,
    previewDelete
  }
}
