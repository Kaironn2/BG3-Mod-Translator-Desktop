import { useCallback } from 'react'

export function useDictionaryIO(): {
  importCsv: (filePath: string) => Promise<number>
  exportCsv: (lang1: string, lang2: string, outputPath: string) => Promise<void>
} {
  const importCsv = useCallback(async (filePath: string) => {
    const result = await window.api.dictionary.import({ filePath, format: 'csv' })
    return result.count
  }, [])

  const exportCsv = useCallback(async (lang1: string, lang2: string, outputPath: string) => {
    await window.api.dictionary.export({ lang1, lang2, format: 'csv', outputPath })
  }, [])

  return { importCsv, exportCsv }
}
