import { useCallback } from 'react'

export function useDictionaryIO(): {
  importCsv: (filePath: string) => Promise<number>
  exportCsv: (
    filters: {
      text?: string
      modName?: string
      sourceLang?: string
      targetLang?: string
    },
    outputPath: string
  ) => Promise<void>
} {
  const importCsv = useCallback(async (filePath: string) => {
    const result = await window.api.dictionary.import({ filePath, format: 'csv' })
    return result.count
  }, [])

  const exportCsv = useCallback(async (filters: {
    text?: string
    modName?: string
    sourceLang?: string
    targetLang?: string
  }, outputPath: string) => {
    await window.api.dictionary.export({ filters, format: 'csv', outputPath })
  }, [])

  return { importCsv, exportCsv }
}
