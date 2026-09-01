import { Archive, Clock, FolderOpen, Package } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { ActionBarStatus } from '@/components/shared/ActionBottomBar'
import { ActionBottomBar } from '@/components/shared/ActionBottomBar'
import { PathFieldCard } from '@/components/shared/PathFieldCard'
import { StepCard } from '@/components/shared/StepCard'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { cn } from '@/lib/utils'

type PackFormat = 'pak' | 'zip'

// Package (pack) flow: unpacked mod folder in, .pak/.zip out. The output file name
// is suggested from the mod's meta.lsx Folder (or the input folder name) when the
// user has not picked one; with a default path configured (Settings) the package
// goes straight to that folder.
export function PackagePage(): React.JSX.Element {
  const { t } = useAppTranslation(['package', 'common', 'toasts'])
  const [inputFolder, setInputFolder] = useState('')
  const [outputPath, setOutputPath] = useState('')
  const [format, setFormat] = useState<PackFormat>('pak')
  const [useDefault, setUseDefault] = useState(false)
  const [defaultPath, setDefaultPath] = useState('')
  const [lastPath, setLastPath] = useState('')
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState<ActionBarStatus | null>(null)

  useEffect(() => {
    window.api.mod.getLastPaths().then((paths) => {
      setLastPath(paths.lastPackPath)
      window.api.config.get({ key: 'default_pack_path' }).then((row) => {
        setDefaultPath(row.value?.trim() ?? '')
      })
    })
  }, [])

  const effectiveOutput = useDefault ? defaultPath : outputPath
  const ready = Boolean(inputFolder && effectiveOutput)

  const pickInput = async (): Promise<void> => {
    const folder = await window.api.fs.openFolder()
    if (!folder) return
    setInputFolder(folder)
    if (!useDefault) {
      const suggested = await window.api.mod.suggestPackFileName({
        inputFolder: folder,
        format
      })
      setOutputPath(suggested ?? '')
    }
  }

  const pickOutput = async (): Promise<void> => {
    const file = await window.api.fs.saveDialog({
      defaultName: `package.${format}`,
      filters: [{ name: format === 'pak' ? 'PAK files' : 'ZIP files', extensions: [format] }]
    })
    if (file) setOutputPath(file)
  }

  const changeFormat = (next: PackFormat): void => {
    setFormat(next)
    if (useDefault || !inputFolder) return
    // Re-suggest the file name with the new extension when a folder is loaded.
    void window.api.mod
      .suggestPackFileName({ inputFolder, format: next })
      .then((suggested) => setOutputPath(suggested ?? ''))
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
    setStatus(null)
    try {
      const result = await window.api.mod.pack({
        inputFolder,
        outputPath: effectiveOutput
      })
      setStatus({ kind: 'success', text: t('logs.created', { path: result.pakPath }) })
      toast.success(t('package.success', { ns: 'toasts' }))
      setLastPath(effectiveOutput)
    } catch (err) {
      const msg = getLocalizedErrorMessage(err, t)
      setStatus({ kind: 'error', text: msg })
      toast.error(msg)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-3 border-b border-[#1f2329] bg-[#131518] px-5">
        <span className="flex items-center gap-1.5 font-mono text-[12px] text-neutral-200">
          <Package size={12} />
          {t('title')}
        </span>
        <span className="flex-1" />
        <span className="flex items-center gap-2 font-mono text-[11px]">
          <span className={inputFolder ? 'text-amber-400' : 'text-neutral-600'}>
            1 {t('steps.folder')}
          </span>
          <span className="text-neutral-700">-</span>
          <span className={effectiveOutput ? 'text-amber-400' : 'text-neutral-600'}>
            2 {t('steps.output')}
          </span>
        </span>
      </div>

      <div className="icosa-scroll min-h-0 flex-1 overflow-y-auto px-6 pt-7 pb-6 [scrollbar-gutter:stable]">
        <div className="mx-auto flex max-w-220 flex-col gap-3.5">
          <StepCard step="01" title={t('inputFolder')} description={t('steps.folderDescription')}>
            <PathFieldCard
              icon={<FolderOpen size={18} />}
              value={inputFolder}
              placeholder={t('selectInputFolder')}
              browseLabel={t('actions.browse', { ns: 'common' })}
              onPick={pickInput}
              onClear={() => setInputFolder('')}
              disabled={running}
            />
          </StepCard>

          <StepCard step="02" title={t('outputFile')} description={t('steps.outputDescription')}>
            <div className="flex flex-col gap-3">
              <div className="flex w-fit gap-1 rounded-lg border border-[#1f2329] bg-[#131518] p-1">
                {(['pak', 'zip'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => changeFormat(value)}
                    disabled={running}
                    className={cn(
                      'cursor-pointer rounded-md px-3 py-1 font-mono text-[12px] font-semibold transition-colors disabled:cursor-not-allowed',
                      format === value
                        ? 'bg-[#23272d] text-amber-400'
                        : 'text-neutral-500 hover:text-neutral-300'
                    )}
                  >
                    .{value}
                  </button>
                ))}
              </div>
              <PathFieldCard
                icon={<Archive size={18} />}
                value={effectiveOutput}
                placeholder={
                  useDefault ? t('usingDefaultPath') : t('saveAs', { format: `.${format}` })
                }
                browseLabel={t('actions.browse', { ns: 'common' })}
                onPick={pickOutput}
                onClear={() => setOutputPath('')}
                disabled={running || useDefault}
              />
            </div>
          </StepCard>

          <label className="flex cursor-pointer items-center gap-2.5 select-none">
            <input
              type="checkbox"
              checked={useDefault}
              onChange={(event) => setUseDefault(event.target.checked)}
              className="h-4 w-4 cursor-pointer accent-amber-400"
              disabled={running}
            />
            <span className="text-[13px] font-medium text-neutral-200">{t('useDefaultPath')}</span>
            <span className="text-[12px] text-neutral-500">({t('configuredInSettings')})</span>
          </label>

          <div className="flex gap-2.5">
            {defaultPath && (
              <button
                type="button"
                onClick={() => void openDefault()}
                disabled={running}
                className="flex h-9 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#2a2f38] bg-transparent px-3 text-[12px] font-medium text-neutral-300 transition-all hover:border-[#4a5568] hover:bg-[#1a1d23] hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FolderOpen size={13} />
                {t('openDefaultPath')}
              </button>
            )}
            {lastPath && (
              <button
                type="button"
                onClick={() => void openLast()}
                disabled={running}
                title={lastPath}
                className="flex h-9 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#2a2f38] bg-transparent px-3 text-[12px] font-medium text-neutral-300 transition-all hover:border-[#4a5568] hover:bg-[#1a1d23] hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Clock size={13} />
                {t('openLastSaved')}
              </button>
            )}
          </div>
        </div>
      </div>

      <ActionBottomBar
        ready={ready}
        running={running}
        status={status}
        icon={<Package size={13} />}
        buttonLabel={t('create')}
        runningLabel={t('creating')}
        idleLabel={t('bottomBar.idle')}
        readyLabel={t('bottomBar.ready')}
        onRun={() => void handlePack()}
      />
    </div>
  )
}
