import { useCallback, useState } from 'react'
import type { DictionaryEntry } from '@/types'

interface Filters {
  lang1: string
  lang2: string
  text: string
}

export function useDictionaryQuery(): {
  entries: DictionaryEntry[]
  loading: boolean
  load: (filters: Filters) => Promise<void>
  setEntries: React.Dispatch<React.SetStateAction<DictionaryEntry[]>>
} {
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

  return { entries, loading, load, setEntries }
}
