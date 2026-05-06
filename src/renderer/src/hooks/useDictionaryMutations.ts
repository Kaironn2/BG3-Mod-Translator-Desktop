import { useCallback } from 'react'
import type { DictionaryEntry } from '@/types'

export function useDictionaryMutations(
  entries: DictionaryEntry[],
  setEntries: React.Dispatch<React.SetStateAction<DictionaryEntry[]>>
): {
  update: (id: number, key: keyof DictionaryEntry, value: string) => Promise<void>
  remove: (id: number) => Promise<void>
} {
  const update = useCallback(
    async (id: number, key: keyof DictionaryEntry, value: string) => {
      const entry = entries.find((e) => e.id === id)
      if (!entry) return
      const updated = { ...entry, [key]: value }
      await window.api.dictionary.upsert({
        language1: updated.language1,
        language2: updated.language2,
        textLanguage1: updated.textLanguage1,
        textLanguage2: updated.textLanguage2,
        modName: updated.modName,
        uid: updated.uid
      })
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, [key]: value } : e)))
    },
    [entries, setEntries]
  )

  const remove = useCallback(
    async (id: number) => {
      await window.api.dictionary.delete({ id })
      setEntries((prev) => prev.filter((e) => e.id !== id))
    },
    [setEntries]
  )

  return { update, remove }
}
