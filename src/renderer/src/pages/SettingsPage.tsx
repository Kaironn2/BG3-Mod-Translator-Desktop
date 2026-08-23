import { Copy, FolderOpen, Settings, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AiProvidersCard } from '@/features/settings/AiProvidersCard'
import { ExternalApiKeysCard } from '@/features/settings/ExternalApiKeysCard'
import { PreferencesCard } from '@/features/settings/PreferencesCard'
import { PromptSlotsCard } from '@/features/settings/PromptSlotsCard'
import { SimilaritySettingsCard } from '@/features/settings/SimilaritySettingsCard'
import { useConfig } from '@/hooks/useConfig'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { useAppTranslation } from '@/i18n/useAppTranslation'

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-800/80 bg-[#141416]">
      <div className="border-b border-neutral-800/50 px-6 py-4">
        <h2 className="text-sm font-medium text-neutral-200">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

export function SettingsPage(): React.JSX.Element {
  const { config, loading, set } = useConfig()
  const [logPath, setLogPath] = useState('')
  const { t } = useAppTranslation(['settings', 'common', 'toasts'])

  useEffect(() => {
    window.api.log.getPath().then(setLogPath)
  }, [])

  const handleOpenLog = async () => {
    try {
      await window.api.log.open()
    } catch (err) {
      toast.error(getLocalizedErrorMessage(err, t))
    }
  }

  const handleCopyLogPath = async () => {
    try {
      await navigator.clipboard.writeText(logPath)
      toast.success(t('settings.logPathCopied', { ns: 'toasts' }))
    } catch (err) {
      toast.error(getLocalizedErrorMessage(err, t))
    }
  }

  const handleClearLog = async () => {
    try {
      await window.api.log.clear()
      toast.success(t('settings.logCleared', { ns: 'toasts' }))
    } catch (err) {
      toast.error(getLocalizedErrorMessage(err, t))
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-neutral-500">{t('loading', { ns: 'common' })}</div>
  }

  return (
    <div className="p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="mb-8">
          <h1 className="flex items-center gap-3 text-2xl font-semibold text-neutral-100">
            <Settings className="h-6 w-6 text-amber-500" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">{t('subtitle')}</p>
        </div>

        <PreferencesCard config={config} set={set} />
        <ExternalApiKeysCard config={config} set={set} />
        <AiProvidersCard />
        <PromptSlotsCard />
        <SimilaritySettingsCard />

        <SettingsCard title={t('sections.debugLogs')}>
          <div className="rounded-md border border-neutral-800/80 bg-[#0a0a0c] p-3 font-mono text-xs break-all text-neutral-400">
            {logPath}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleOpenLog}
              className="inline-flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
            >
              <FolderOpen size={15} />
              {t('actions.open', { ns: 'common' })}
            </button>
            <button
              type="button"
              onClick={handleCopyLogPath}
              className="inline-flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
            >
              <Copy size={15} />
              {t('actions.copyPath', { ns: 'common' })}
            </button>
            <button
              type="button"
              onClick={handleClearLog}
              className="inline-flex items-center gap-2 rounded-md border border-red-900/70 bg-red-950/40 px-4 py-2 text-sm text-red-300 transition-colors hover:bg-red-950"
            >
              <Trash2 size={15} />
              {t('actions.clear', { ns: 'common' })}
            </button>
          </div>
        </SettingsCard>

        <div className="h-4" />
      </div>
    </div>
  )
}
