import { Archive, Clock, File, FolderOpen, PackageOpen } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { ActionBarStatus } from '@/components/shared/ActionBottomBar'
import { ActionBottomBar } from '@/components/shared/ActionBottomBar'
import { PathFieldCard } from '@/components/shared/PathFieldCard'
import { StepCard } from '@/components/shared/StepCard'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { useAppTranslation } from '@/i18n/useAppTranslation'

// Extract is a pure "unpack" step: .zip (auto-extracted) or .pak in, unpacked
// folder out. No language selection — the translation import scans every
// Localization/ folder itself.
export function ExtractPage(): React.JSX.Element {
  const { t } = useAppTranslation(['extract', 'common', 'toasts'])
  const [inputPath, setInputPath] = useState('')
  const [outputPath, setOutputPath] = useState('')
  const [useDefault, setUseDefault] = useState(false)
  const [defaultPath, setDefaultPath] = useState('')
  const [lastPath, setLastPath] = useState('')
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState<ActionBarStatus | null>(null)

  useEffect(() => {
    window.api.mod.getLastPaths().then((paths) => {
      setLastPath(paths.lastExtractPath)
      window.api.config.get({ key: 'default_extract_path' }).then((row) => {
        setDefaultPath(row.value?.trim() ?? '')
      })
    })
  }, [])

  const effectiveOutput = useDefault ? defaultPath : outputPath
  const ready = Boolean(inputPath && effectiveOutput)

  const pickInput = async (): Promise<void> => {
    const paths = await window.api.fs.openDialog({
      filters: [{ name: 'Mod files', extensions: ['zip', 'pak'] }]
    })
    if (paths[0]) setInputPath(paths[0])
  }

  const pickOutput = async (): Promise<void> => {
    const folder = await window.api.fs.openFolder()
    if (folder) setOutputPath(folder)
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
    setStatus(null)
    try {
      const result = await window.api.mod.extract({
        inputPath,
        outputPath: effectiveOutput
      })
      setStatus({
        kind: 'success',
        text: `${t('logs.success')} · ${t('logs.foundXml', { count: result.xmlFiles.length })}`
      })
      toast.success(t('extract.success', { ns: 'toasts', count: result.xmlFiles.length }))
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
          <PackageOpen size={12} />
          {t('title')}
        </span>
        <span className="flex-1" />
        <span className="flex items-center gap-2 font-mono text-[11px]">
          <span className={inputPath ? 'text-amber-400' : 'text-neutral-600'}>
            1 {t('steps.file')}
          </span>
          <span className="text-neutral-700">-</span>
          <span className={effectiveOutput ? 'text-amber-400' : 'text-neutral-600'}>
            2 {t('steps.output')}
          </span>
        </span>
      </div>

      <div className="icosa-scroll min-h-0 flex-1 overflow-y-auto px-6 pt-7 pb-6 [scrollbar-gutter:stable]">
        <div className="mx-auto flex max-w-220 flex-col gap-3.5">
          <StepCard step="01" title={t('inputFile')} description={t('steps.fileDescription')}>
            <PathFieldCard
              icon={<File size={18} />}
              value={inputPath}
              placeholder={t('dropLabel')}
              browseLabel={t('actions.browse', { ns: 'common' })}
              accept={['zip', 'pak']}
              onPick={pickInput}
              onFile={setInputPath}
              onClear={() => setInputPath('')}
              disabled={running}
            />
          </StepCard>

          <StepCard step="02" title={t('outputFolder')} description={t('steps.outputDescription')}>
            <PathFieldCard
              icon={<FolderOpen size={18} />}
              value={effectiveOutput}
              placeholder={useDefault ? t('usingDefaultPath') : t('selectOutputFolder')}
              browseLabel={t('actions.browse', { ns: 'common' })}
              onPick={pickOutput}
              onClear={() => setOutputPath('')}
              disabled={running || useDefault}
            />
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
        icon={<Archive size={13} />}
        buttonLabel={t('extract')}
        runningLabel={t('extracting')}
        idleLabel={t('bottomBar.idle')}
        readyLabel={t('bottomBar.ready')}
        onRun={() => void handleExtract()}
      />
    </div>
  )
}
