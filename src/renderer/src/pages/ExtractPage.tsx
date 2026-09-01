import { Clock, FolderOpen, Loader2, PackageOpen } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AmberCheckbox } from '@/components/shared/AmberCheckbox'
import { FileDropZone } from '@/components/shared/FileDropZone'
import { PathInputRow } from '@/components/shared/PathInputRow'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { useAppTranslation } from '@/i18n/useAppTranslation'

export function ExtractPage(): React.JSX.Element {
  const { t } = useAppTranslation(['extract', 'common', 'toasts'])
  const [inputPath, setInputPath] = useState('')
  const [outputPath, setOutputPath] = useState('')
  const [useDefault, setUseDefault] = useState(false)
  const [defaultPath, setDefaultPath] = useState('')
  const [lastPath, setLastPath] = useState('')
  const [running, setRunning] = useState(false)

  useEffect(() => {
    void window.api.mod.getLastPaths().then((paths) => {
      setLastPath(paths.lastExtractPath)
    })
    void window.api.config.get({ key: 'default_extract_path' }).then((row) => {
      const value = row.value?.trim() ?? ''
      setDefaultPath(value)
      if (value) setUseDefault(true)
    })
  }, [])

  const effectiveOutput = useDefault ? defaultPath : outputPath
  const ready = Boolean(inputPath && effectiveOutput)

  const pickOutput = async (): Promise<void> => {
    const folder = await window.api.fs.openFolder()
    if (folder) {
      setOutputPath(folder)
      setUseDefault(false)
    }
  }

  const openDefault = async (): Promise<void> => {
    if (!defaultPath) return
    await window.api.fs.openInShell(defaultPath)
  }

  const openLast = async (): Promise<void> => {
    if (!lastPath) return
    await window.api.fs.openInShell(lastPath)
  }

  const handleExtract = async (): Promise<void> => {
    if (!ready) return
    setRunning(true)
    try {
      const result = await window.api.mod.extract({
        inputPath,
        outputPath: effectiveOutput
      })
      toast.success(t('extract.success', { ns: 'toasts', count: result.xmlFiles.length }))
      setLastPath(effectiveOutput)
    } catch (err) {
      toast.error(getLocalizedErrorMessage(err, t))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 justify-center overflow-y-auto px-12 py-10">
      <div className="flex w-full max-w-[520px] flex-col gap-6">
        <h1 className="m-0 text-[22px] font-semibold tracking-tight text-neutral-100">
          {t('title')}
        </h1>

        <FileDropZone
          accept={['zip', 'pak']}
          value={inputPath}
          label={t('dropLabel')}
          onFile={setInputPath}
          onClear={() => setInputPath('')}
          disabled={running}
        />

        <div className="flex flex-col gap-2.5">
          <PathInputRow
            label={t('outputFolder')}
            value={effectiveOutput}
            placeholder={t('selectOutputFolder')}
            onBrowse={pickOutput}
            disabled={running}
            locked={useDefault && Boolean(defaultPath)}
          />

          <div className="flex cursor-pointer items-center gap-2.5 select-none">
            <AmberCheckbox
              checked={useDefault && Boolean(defaultPath)}
              disabled={running || !defaultPath}
              onChange={setUseDefault}
            />
            <button
              type="button"
              disabled={running || !defaultPath}
              onClick={() => setUseDefault((v) => !v)}
              className="flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-left disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="text-[13px] font-medium text-neutral-200">
                {t('useDefaultPath')}
              </span>
              <span className="text-[12px] text-neutral-500">({t('configuredInSettings')})</span>
            </button>
          </div>

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => void openDefault()}
              disabled={running || !defaultPath}
              className="flex h-9 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#2a2f38] bg-transparent px-3 text-[12px] font-medium text-neutral-300 transition-all hover:border-[#4a5568] hover:bg-[#1a1d23] hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FolderOpen size={13} />
              {t('openDefaultPath')}
            </button>
            <button
              type="button"
              onClick={() => void openLast()}
              disabled={running || !lastPath}
              title={lastPath || undefined}
              className="flex h-9 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#2a2f38] bg-transparent px-3 text-[12px] font-medium text-neutral-300 transition-all hover:border-[#4a5568] hover:bg-[#1a1d23] hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Clock size={13} />
              {t('openLastSaved')}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleExtract()}
          disabled={!ready || running}
          className="mt-1 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-amber-500 text-[15px] font-semibold text-neutral-950 transition-all hover:bg-amber-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? <Loader2 size={16} className="animate-spin" /> : <PackageOpen size={16} />}
          {running ? t('extracting') : t('extract')}
        </button>
      </div>
    </div>
  )
}
