import { useState, useCallback } from 'react'
import type { DictionaryEntry } from '@/types'

interface Filters {
  lang1: string
  lang2: string
  text: string
}

export function useDictionary() {
  const [entries, setEntries] = useState<DictionaryEntry[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (filters: Filters) => {
    if (!filters.lang1 || !filters.lang2) return
    setLoading(true)
    try {
      const result = filters.text
        ? await window.api.dictionary.search({
            text: filters.text,
            lang1: filters.lang1,
            lang2: filters.lang2
          })
        : await window.api.dictionary.getAll({ lang1: filters.lang1, lang2: filters.lang2 })
      setEntries(result)
    } finally {
      setLoading(false)
    }
  }, [])

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
    [entries]
  )

  const remove = useCallback(async (id: number) => {
    await window.api.dictionary.delete({ id })
    setEntries((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const importCsv = useCallback(async (filePath: string) => {
    const result = await window.api.dictionary.import({ filePath, format: 'csv' })
    return result.count
  }, [])

  const exportCsv = useCallback(async (lang1: string, lang2: string, outputPath: string) => {
    await window.api.dictionary.export({ lang1, lang2, format: 'csv', outputPath })
  }, [])

  return { entries, loading, load, update, remove, importCsv, exportCsv }
}
