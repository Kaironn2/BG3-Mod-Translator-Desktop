import { useState } from 'react'
import { toast } from 'sonner'
import { DragDrop } from '@/components/shared/DragDrop'
import { LanguageSelect } from '@/components/shared/LanguageSelect'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { useAppTranslation } from '@/i18n/useAppTranslation'

export function ExtractPage(): React.JSX.Element {
  const { t } = useAppTranslation(['extract', 'common', 'toasts'])
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
        t('logs.success'),
        t('logs.foundXml', { count: result.xmlFiles.length }),
        ...result.xmlFiles.map((f) => `  ${f}`)
      ]
      setLog(lines)
      toast.success(t('extract.success', { ns: 'toasts', count: result.xmlFiles.length }))
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

      <DragDrop
        accept={['zip', 'pak']}
        onFile={setInputPath}
        label={t('dropLabel')}
      />

      {inputPath && (
        <p className="truncate text-xs text-neutral-400" title={inputPath}>
          {inputPath}
        </p>
      )}

      <LanguageSelect
        label={t('fields.sourceLanguage', { ns: 'common' })}
        value={sourceLang}
        onChange={setSourceLang}
        className="w-56"
      />

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-400">{t('outputFolder')}</label>
        <div className="flex gap-2">
          <input
            readOnly
            value={outputPath}
            placeholder={t('selectOutputFolder')}
            className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-400"
          />
          <button
            onClick={pickOutput}
            className="cursor-pointer rounded-md bg-neutral-800 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-700"
          >
            {t('actions.browse', { ns: 'common' })}
          </button>
        </div>
      </div>

      <button
        onClick={handleExtract}
        disabled={running || !inputPath || !outputPath || !sourceLang}
        className="w-fit cursor-pointer rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {running ? t('extracting') : t('extract')}
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
