import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useDictionary } from '@/hooks/useDictionary'
import { LanguageSelect } from '@/components/shared/LanguageSelect'
import { EditableTable, type Column } from '@/components/shared/EditableTable'
import type { DictionaryEntry } from '@/types'

const COLUMNS: Column<DictionaryEntry>[] = [
  { key: 'textLanguage1', header: 'Source', editable: true },
  { key: 'textLanguage2', header: 'Target', editable: true },
  { key: 'language1', header: 'Lang 1', width: '80px' },
  { key: 'language2', header: 'Lang 2', width: '80px' },
  { key: 'uid', header: 'UID', width: '180px' },
  { key: 'modName', header: 'Mod', width: '140px' }
]

export function DictionaryPage(): React.JSX.Element {
  const [lang1, setLang1] = useState('')
  const [lang2, setLang2] = useState('')
  const [text, setText] = useState('')
  const { entries, loading, load, update, importCsv, exportCsv } = useDictionary()

  useEffect(() => {
    load({ lang1, lang2, text })
  }, [lang1, lang2, text, load])

  const handleImport = async () => {
    const paths = await window.api.fs.openDialog({
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (!paths[0]) return
    const count = await importCsv(paths[0])
    load({ lang1, lang2, text })
    toast.success(`Imported ${count} entries`)
  }

  const handleExport = async () => {
    const outputPath = await window.api.fs.saveDialog({
      defaultName: `dictionary_${lang1}_${lang2}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (!outputPath) return
    await exportCsv(lang1, lang2, outputPath)
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-neutral-100">Dictionary</h1>
        <div className="flex gap-2">
          <button
            onClick={handleImport}
            className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700"
          >
            Import CSV
          </button>
          <button
            onClick={handleExport}
            disabled={!lang1 || !lang2}
            className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700 disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <LanguageSelect label="Language 1" value={lang1} onChange={setLang1} className="w-44" />
        <LanguageSelect label="Language 2" value={lang2} onChange={setLang2} className="w-44" />
        <div className="flex flex-1 flex-col gap-1">
          <label className="text-xs text-neutral-400">Search text</label>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Filter by text..."
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:border-neutral-500 focus:outline-none"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-neutral-500">Loading...</p>
      ) : (
        <div className="flex flex-col gap-1 overflow-hidden flex-1">
          <p className="text-xs text-neutral-600">{entries.length} entries</p>
          <EditableTable
            columns={COLUMNS}
            data={entries}
            onUpdate={(id, key, value) => update(id, key as keyof DictionaryEntry, value)}
            className="flex-1"
          />
        </div>
      )}
    </div>
  )
}
