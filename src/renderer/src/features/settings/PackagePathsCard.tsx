import { FolderOpen, Package } from 'lucide-react'
import { toast } from 'sonner'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { ConfigKey } from '@/types'
import { SettingsSectionCard } from './SettingsSectionCard'

interface PackagePathsCardProps {
  config: Record<string, string>
  set: (key: ConfigKey, value: string) => Promise<void>
}

// Default output folders for the package tools: Extract (unpack a .pak/.zip) and
// Create package (pack a folder). When set, the package pages can send output
// straight to these folders via the "Use default path" checkbox.
export function PackagePathsCard({ config, set }: PackagePathsCardProps): React.JSX.Element {
  const { t } = useAppTranslation(['settings', 'toasts'])

  const pickFolder = async (key: ConfigKey, label: string): Promise<void> => {
    const folder = await window.api.fs.openFolder()
    if (!folder) return
    await set(key, folder)
    toast.success(t('settings.saved', { ns: 'toasts', label }))
  }

  const renderPath = (key: ConfigKey): string => config[key] || t('placeholders.noPathSet')

  const rows: { key: ConfigKey; label: string }[] = [
    { key: 'default_extract_path', label: t('fields.defaultExtractPath') },
    { key: 'default_pack_path', label: t('fields.defaultPackPath') }
  ]

  return (
    <SettingsSectionCard
      title={t('sections.packagePaths')}
      subtitle={t('sections.packagePathsSubtitle')}
      icon={<Package size={16} />}
    >
      <div className="flex flex-col gap-4">
        {rows.map(({ key, label }) => (
          <div key={key} className="flex flex-col gap-1.5">
            <span className="text-xs text-neutral-400">{label}</span>
            <div className="flex items-center gap-2">
              <div
                className="min-w-0 flex-1 truncate rounded-md border border-[#1f2329] bg-[#0f1114] px-3 py-2.5 font-mono text-sm text-neutral-300"
                title={config[key] || ''}
              >
                {renderPath(key)}
              </div>
              <button
                type="button"
                onClick={() => void pickFolder(key, label)}
                className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-[#1f2329] bg-[#0f1114] px-4 text-sm text-neutral-300 transition-colors hover:border-[#252a32] hover:text-neutral-100"
              >
                <FolderOpen size={14} />
                {t('actions.browse', { ns: 'common' })}
              </button>
              {config[key] && (
                <button
                  type="button"
                  onClick={() => void set(key, '')}
                  className="inline-flex h-10 shrink-0 cursor-pointer items-center rounded-md border border-[#1f2329] bg-[#0f1114] px-3 text-sm text-neutral-500 transition-colors hover:border-red-500/30 hover:text-red-300"
                >
                  {t('actions.clear', { ns: 'common' })}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 text-right text-xs text-neutral-500">{t('autoSaved')}</div>
    </SettingsSectionCard>
  )
}
