import { useState } from 'react'
import { toast } from 'sonner'
import { DragDrop } from '@/components/shared/DragDrop'
import { LanguageSelect } from '@/components/shared/LanguageSelect'

export function ExtractPage(): React.JSX.Element {
  const [inputPath, setInputPath] = useState('')
  const [outputPath, setOutputPath] = useState('')
  const [sourceLang, setSourceLang] = useState('')
  const [log, setLog] = useState<string[]>([])
  const [running, setRunning] = useState(false)

  const pickOutput = async () => {
    const folder = await window.api.fs.openFolder()
    if (folder) setOutputPath(folder)
  }

  const handleExtract = async () => {
    if (!inputPath || !outputPath || !sourceLang) return
    setRunning(true)
    setLog([])
    try {
      const result = await window.api.mod.extract({ inputPath, outputPath, sourceLang })
      const lines = [
        `Extracted successfully.`,
        `Found ${result.xmlFiles.length} localization XML(s):`,
        ...result.xmlFiles.map((f) => `  ${f}`)
      ]
      setLog(lines)
      toast.success(`Extracted - ${result.xmlFiles.length} XML(s) found`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setLog([`Error: ${msg}`])
      toast.error(msg)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold text-neutral-100">Extract Mod</h1>

      <DragDrop
        accept={['zip', 'pak']}
        onFile={setInputPath}
        label="Drop your .zip or .pak file here"
      />

      {inputPath && (
        <p className="truncate text-xs text-neutral-400" title={inputPath}>
          {inputPath}
        </p>
      )}

      <LanguageSelect
        label="Source language"
        value={sourceLang}
        onChange={setSourceLang}
        className="w-56"
      />

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-400">Output folder</label>
        <div className="flex gap-2">
          <input
            readOnly
            value={outputPath}
            placeholder="Select output folder..."
            className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-400"
          />
          <button
            onClick={pickOutput}
            className="rounded-md bg-neutral-800 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-700"
          >
            Browse
          </button>
        </div>
      </div>

      <button
        onClick={handleExtract}
        disabled={running || !inputPath || !outputPath || !sourceLang}
        className="w-fit rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {running ? 'Extracting...' : 'Extract'}
      </button>

      {log.length > 0 && (
        <div className="rounded-md bg-neutral-900 p-3 font-mono text-xs text-neutral-300">
          {log.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}
    </div>
  )
}
