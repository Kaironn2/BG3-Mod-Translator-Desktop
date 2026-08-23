import { Download, Loader2 } from 'lucide-react'
import { useUpdater } from '@/context/UpdaterSession'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { cn } from '@/lib/utils'
import { PercentBar } from './PercentBar'

const NO_DRAG: React.CSSProperties & { WebkitAppRegion?: string } = { WebkitAppRegion: 'no-drag' }

export function SidebarUpdateControl(): React.JSX.Element {
  const { state, install } = useUpdater()
  const { t } = useAppTranslation('updater')
  const busy =
    state.status === 'checking' ||
    state.status === 'backing-up' ||
    state.status === 'downloading' ||
    state.status === 'installing'
  const canInstall =
    (state.status === 'available' || state.status === 'ready') && state.channel === 'installed'

  return (
    <div style={NO_DRAG} className="mt-1 flex flex-col gap-1">
      <div
        title={`v${state.currentVersion || '—'}`}
        className="flex h-9 w-full items-center gap-3 rounded-md px-2 text-neutral-500"
      >
        <span className="flex w-6 shrink-0 items-center justify-center text-[10px] font-semibold tracking-wide">
          {busy ? <Loader2 size={14} className="animate-spin text-amber-400" /> : 'v'}
        </span>
        <span
          style={{ transition: 'opacity 120ms 60ms' }}
          className="flex-1 truncate text-xs opacity-0 group-hover/sidebar:opacity-100"
        >
          v{state.currentVersion || '—'}
        </span>
      </div>

      {canInstall && (
        <button
          type="button"
          title={t('updateTo', { version: state.latestVersion })}
          onClick={() => {
            void install()
          }}
          className={cn(
            'flex h-9 w-full cursor-pointer items-center gap-3 rounded-md px-2 text-amber-400 transition-colors',
            'hover:bg-amber-500/12 hover:text-amber-300'
          )}
        >
          <span className="flex w-6 shrink-0 items-center justify-center">
            <Download size={16} />
          </span>
          <span
            style={{ transition: 'opacity 120ms 60ms' }}
            className="flex-1 truncate text-sm font-medium opacity-0 group-hover/sidebar:opacity-100"
          >
            {t('updateTo', { version: state.latestVersion })}
          </span>
        </button>
      )}

      {(state.status === 'downloading' || state.status === 'backing-up') && (
        <div
          style={{ transition: 'opacity 120ms 60ms' }}
          className="px-2 pb-1 opacity-0 group-hover/sidebar:opacity-100"
        >
          <PercentBar
            percent={state.status === 'backing-up' ? state.backupPercent : state.downloadPercent}
            label={state.status === 'backing-up' ? t('backingUp') : t('downloading')}
          />
        </div>
      )}
    </div>
  )
}
