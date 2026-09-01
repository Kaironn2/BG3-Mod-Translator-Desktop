import { Clock, FolderOpen, Loader2, Package } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AmberCheckbox } from '@/components/shared/AmberCheckbox'
import { FileDropZone } from '@/components/shared/FileDropZone'
import { PathInputRow } from '@/components/shared/PathInputRow'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { cn } from '@/lib/utils'

type PackFormat = 'pak' | 'zip'

export function PackagePage(): React.JSX.Element {
  const { t } = useAppTranslation(['package', 'common', 'toasts'])
  const [inputFolder, setInputFolder] = useState('')
  const [outputFileName, setOutputFileName] = useState('')
  const [outputPath, setOutputPath] = useState('')
  const [format, setFormat] = useState<PackFormat>('pak')
  const [useDefault, setUseDefault] = useState(false)
  const [defaultPath, setDefaultPath] = useState('')
  const [lastPath, setLastPath] = useState('')
  const [running, setRunning] = useState(false)

  useEffect(() => {
    void window.api.mod.getLastPaths().then((paths) => {
      setLastPath(paths.lastPackPath)
    })
    void window.api.config.get({ key: 'default_pack_path' }).then((row) => {
      const value = row.value?.trim() ?? ''
      setDefaultPath(value)
      if (value) setUseDefault(true)
    })
  }, [])

  const displayOutput = (): string => {
    if (useDefault && defaultPath) {
      const name = outputFileName || `package.${format}`
      return joinPath(defaultPath, name)
    }
    return outputPath
  }

  const ready = Boolean(inputFolder && (useDefault ? defaultPath : outputPath))

  const handleInputFolder = (folder: string): void => {
    setInputFolder(folder)
    void window.api.mod.suggestPackFileName({ inputFolder: folder, format }).then((suggested) => {
      const name = suggested ?? `package.${format}`
      setOutputFileName(name)
      if (!useDefault) {
        // Pre-fill a full path next to the input folder so the user can edit via Browse.
        setOutputPath(joinPath(parentDir(folder), name))
      }
    })
  }

  const pickOutput = async (): Promise<void> => {
    const suggested =
      outputFileName ||
      (inputFolder
        ? ((await window.api.mod.suggestPackFileName({ inputFolder, format })) ??
          `package.${format}`)
        : `package.${format}`)
    const file = await window.api.fs.saveDialog({
      defaultName: suggested,
      filters: [{ name: format === 'pak' ? 'PAK files' : 'ZIP files', extensions: [format] }]
    })
    if (!file) return
    setOutputPath(file)
    setOutputFileName(baseName(file))
    setUseDefault(false)
  }

  const changeFormat = (next: PackFormat): void => {
    setFormat(next)
    const rename = (name: string): string => name.replace(/\.(pak|zip)$/i, `.${next}`)
    if (outputFileName) setOutputFileName(rename(outputFileName))
    if (outputPath) setOutputPath(rename(outputPath))
    if (inputFolder && !outputFileName && !outputPath) {
      void window.api.mod.suggestPackFileName({ inputFolder, format: next }).then((suggested) => {
        if (!suggested) return
        setOutputFileName(suggested)
        if (!useDefault) setOutputPath(joinPath(parentDir(inputFolder), suggested))
      })
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

  const handlePack = async (): Promise<void> => {
    if (!ready) return
    setRunning(true)
    try {
      const finalOutput = displayOutput()
      const result = await window.api.mod.pack({
        inputFolder,
        outputPath: finalOutput
      })
      toast.success(t('package.success', { ns: 'toasts' }))
      setLastPath(result.pakPath)
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
          mode="folder"
          value={inputFolder}
          label={t('dropLabel')}
          onFile={handleInputFolder}
          onClear={() => setInputFolder('')}
          disabled={running}
        />

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-neutral-400">{t('outputFormat')}</span>
          <div className="flex rounded-[10px] border border-[#2a2a2a] bg-[#121212] p-1">
            {(['pak', 'zip'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => changeFormat(value)}
                disabled={running}
                className={cn(
                  'h-10 flex-1 cursor-pointer rounded-lg text-[14px] font-medium transition-colors disabled:cursor-not-allowed',
                  format === value
                    ? 'bg-[#1e1e1e] text-neutral-100 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-300'
                )}
              >
                .{value}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <PathInputRow
            label={t('outputFile')}
            value={displayOutput()}
            placeholder={t('saveAs', { format: `.${format}` })}
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
          onClick={() => void handlePack()}
          disabled={!ready || running}
          className="mt-1 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] bg-amber-500 text-[15px] font-semibold text-neutral-950 transition-all hover:bg-amber-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
          {running ? t('creating') : t('create')}
        </button>
      </div>
    </div>
  )
}

function baseName(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || filePath
}

function parentDir(folder: string): string {
  const normalized = folder.replace(/\\/g, '/').replace(/\/+$/, '')
  const idx = normalized.lastIndexOf('/')
  if (idx <= 0) return folder
  return normalized.slice(0, idx).replace(/\//g, '\\')
}

function joinPath(dir: string, name: string): string {
  if (!dir) return name
  if (!name) return dir
  if (/[/\\]/.test(name)) return name
  return `${dir.replace(/[/\\]+$/, '')}\\${name}`
}
