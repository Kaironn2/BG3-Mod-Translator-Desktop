import { useState } from 'react'
import { toast } from 'sonner'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { useAppTranslation } from '@/i18n/useAppTranslation'

export function PackagePage(): React.JSX.Element {
  const { t } = useAppTranslation(['package', 'common', 'toasts'])
  const [inputFolder, setInputFolder] = useState('')
  const [outputPath, setOutputPath] = useState('')
  const [log, setLog] = useState<string[]>([])
  const [running, setRunning] = useState(false)

  const pickInput = async () => {
    const folder = await window.api.fs.openFolder()
    if (folder) setInputFolder(folder)
  }

  const pickOutput = async () => {
    const file = await window.api.fs.saveDialog({
      defaultName: 'mod.pak',
      filters: [{ name: 'PAK files', extensions: ['pak'] }]
    })
    if (file) setOutputPath(file)
  }

  const handlePack = async () => {
    if (!inputFolder || !outputPath) return
    setRunning(true)
    setLog([])
    try {
      const result = await window.api.mod.pack({ inputFolder, outputPath })
      setLog([t('logs.created', { path: result.pakPath })])
      toast.success(t('package.success', { ns: 'toasts' }))
    } catch (err) {
      const msg = getLocalizedErrorMessage(err, t)
      setLog([t('logs.error', { message: msg })])
      toast.error(msg)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold text-neutral-100">{t('title')}</h1>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-400">{t('inputFolder')}</label>
        <div className="flex gap-2">
          <input
            readOnly
            value={inputFolder}
            placeholder={t('selectInputFolder')}
            className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-400"
          />
          <button
            onClick={pickInput}
            className="rounded-md bg-neutral-800 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-700"
          >
            {t('actions.browse', { ns: 'common' })}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-400">{t('outputFile')}</label>
        <div className="flex gap-2">
          <input
            readOnly
            value={outputPath}
            placeholder={t('saveAsPak')}
            className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-400"
          />
          <button
            onClick={pickOutput}
            className="rounded-md bg-neutral-800 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-700"
          >
            {t('actions.browse', { ns: 'common' })}
          </button>
        </div>
      </div>

      <button
        onClick={handlePack}
        disabled={running || !inputFolder || !outputPath}
        className="w-fit rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {running ? t('creating') : t('create')}
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
