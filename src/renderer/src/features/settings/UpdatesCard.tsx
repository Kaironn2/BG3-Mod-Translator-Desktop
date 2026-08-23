import { Download, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { useUpdater } from '@/context/UpdaterSession'
import { formatBytes } from '@/features/updater/formatBytes'
import { PercentBar } from '@/features/updater/PercentBar'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { SettingsSectionCard } from './SettingsSectionCard'

export function UpdatesCard(): React.JSX.Element {
  const { state, check, install } = useUpdater()
  const { t } = useAppTranslation('updater')
  const busy =
    state.status === 'checking' ||
    state.status === 'backing-up' ||
    state.status === 'downloading' ||
    state.status === 'installing'
  const canInstall =
    (state.status === 'available' || state.status === 'ready') && state.channel === 'installed'
  const canCheck = state.channel === 'installed' && !busy

  return (
    <SettingsSectionCard title={t('title')} subtitle={t('subtitle')} icon={<Sparkles size={16} />}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <VersionField label={t('currentVersion')} value={`v${state.currentVersion || '—'}`} />
          <VersionField
            label={t('latestVersion')}
            value={state.latestVersion ? `v${state.latestVersion}` : t('unknownLatest')}
          />
        </div>

        <p className="text-sm text-neutral-400">{statusMessage(state, t)}</p>

        {state.status === 'downloading' && (
          <PercentBar
            percent={state.downloadPercent}
            label={t('downloadingBytes', {
              current: formatBytes(state.downloadedBytes),
              total: formatBytes(state.totalBytes)
            })}
          />
        )}
        {state.status === 'backing-up' && (
          <PercentBar percent={state.backupPercent} label={t('backingUp')} />
        )}
        {state.status === 'installing' && (
          <div className="flex items-center gap-2 text-sm text-amber-400">
            <Loader2 size={14} className="animate-spin" />
            {t('installing')}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canCheck}
            onClick={() => {
              void check()
            }}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {state.status === 'checking' ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <RefreshCw size={15} />
            )}
            {state.status === 'checking' ? t('checking') : t('check')}
          </button>

          {canInstall && (
            <button
              type="button"
              onClick={() => {
                void install()
              }}
              className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-neutral-950 transition-colors hover:bg-amber-400"
            >
              <Download size={15} />
              {t('updateTo', { version: state.latestVersion })}
            </button>
          )}
        </div>
      </div>
    </SettingsSectionCard>
  )
}

function VersionField({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-md border border-neutral-800/80 bg-[#0a0a0c] px-3 py-2.5">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-neutral-200">{value}</div>
    </div>
  )
}

function statusMessage(
  state: ReturnType<typeof useUpdater>['state'],
  t: ReturnType<typeof useAppTranslation>['t']
): string {
  if (state.channel === 'dev') return t('unsupportedDev')
  if (state.channel === 'portable') return t('unsupportedPortable')
  if (state.channel === 'unsupported') return t('unsupportedPlatform')
  if (state.errorCode) {
    switch (state.errorCode) {
      case 'checkFailed':
        return t('errors.checkFailed')
      case 'downloadFailed':
        return t('errors.downloadFailed')
      case 'backupFailed':
        return t('errors.backupFailed')
      case 'installFailed':
        return t('errors.installFailed')
      case 'untrusted':
        return t('errors.untrusted')
      case 'offline':
        return t('errors.offline')
      default:
        return t('errors.unsupported')
    }
  }

  switch (state.status) {
    case 'checking':
      return t('checking')
    case 'up-to-date':
      return t('upToDate')
    case 'available':
    case 'ready':
      return t('updateAvailable', { version: state.latestVersion })
    case 'backing-up':
      return t('backingUp')
    case 'downloading':
      return t('downloading')
    case 'installing':
      return t('installing')
    default:
      return t('idle')
  }
}
