import { ExternalLink, Sparkles } from 'lucide-react'
import { ModalShell } from '@/components/shared/ModalShell'
import { useUpdater } from '@/context/UpdaterSession'
import { useAppTranslation } from '@/i18n/useAppTranslation'

export function ChangelogModal(): React.JSX.Element {
  const { state, ackChangelog } = useUpdater()
  const { t } = useAppTranslation(['updater', 'common'])
  const changelog = state.changelog

  return (
    <ModalShell
      open={Boolean(changelog)}
      title={t('updatedTitle', { version: changelog?.toVersion ?? state.currentVersion })}
      description={
        changelog
          ? t('updatedFrom', { from: changelog.fromVersion, to: changelog.toVersion })
          : undefined
      }
      icon={<Sparkles size={16} />}
      sizeClassName="max-w-lg"
      onClose={() => {
        void ackChangelog()
      }}
      footer={
        <button
          type="button"
          onClick={() => {
            void ackChangelog()
          }}
          className="inline-flex cursor-pointer items-center rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-neutral-950 transition-colors hover:bg-amber-400"
        >
          {t('actions.close', { ns: 'common' })}
        </button>
      }
    >
      {changelog && (
        <p className="text-sm leading-6 text-neutral-300">
          {t('seeChangelog')}{' '}
          <a
            href={changelog.url}
            target="_blank"
            rel="noreferrer"
            className="break-all text-amber-400 hover:text-amber-300"
          >
            {changelog.url}
          </a>{' '}
          <ExternalLink size={14} className="inline shrink-0 align-text-bottom text-amber-400" />
        </p>
      )}
    </ModalShell>
  )
}
