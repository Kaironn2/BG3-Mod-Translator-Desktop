import { AlertTriangle, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ModalShell } from '@/components/shared/ModalShell'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { DeleteModsPreview } from '@/types'

const NAME_PREVIEW_LIMIT = 8

interface DeleteModConfirmProps {
  open: boolean
  modNames: string[]
  onClose: () => void
  onConfirm: (modNames: string[]) => void
}

export function DeleteModConfirm({
  open,
  modNames,
  onClose,
  onConfirm
}: DeleteModConfirmProps): React.JSX.Element | null {
  const { t } = useAppTranslation('mods')

  const [preview, setPreview] = useState<DeleteModsPreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  const isMany = modNames.length > 1

  useEffect(() => {
    if (!open || modNames.length === 0) return

    setLoadingPreview(true)
    setPreview(null)

    window.api.mod
      .previewDeleteMany({ modNames })
      .then((data) => {
        setPreview(data)
      })
      .catch(() => {
        toast.error(t('toast.deleteFailed'))
        onClose()
      })
      .finally(() => {
        setLoadingPreview(false)
      })
  }, [open, modNames, t, onClose])

  function handleConfirm() {
    if (modNames.length === 0 || loadingPreview) return
    onConfirm(modNames)
  }

  const visibleNames = modNames.slice(0, NAME_PREVIEW_LIMIT)
  const hiddenCount = Math.max(0, modNames.length - visibleNames.length)

  return (
    <ModalShell
      open={open}
      title={isMany ? t('delete.titleMany', { count: modNames.length }) : t('delete.title')}
      sizeClassName="max-w-md"
      icon={<AlertTriangle size={16} />}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 cursor-pointer items-center rounded-md border border-neutral-700 bg-[#131518] px-3 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-800"
          >
            {t('delete.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loadingPreview || modNames.length === 0}
            className="inline-flex h-8 cursor-pointer items-center rounded-md border border-red-500/40 bg-red-500/10 px-3 text-xs font-semibold text-red-200 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isMany ? t('delete.confirmMany') : t('delete.confirm')}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-neutral-300">
          {isMany
            ? t('delete.subjectMany', { count: modNames.length })
            : t('delete.subject', { name: modNames[0] })}
        </p>

        {isMany && (
          <ul className="max-h-32 overflow-y-auto rounded border border-[#1f2329] bg-[#0f1114] px-3 py-2 text-sm text-neutral-300">
            {visibleNames.map((name) => (
              <li key={name} className="truncate py-0.5">
                {name}
              </li>
            ))}
            {hiddenCount > 0 && (
              <li className="py-0.5 text-xs text-neutral-500">
                {t('delete.moreNames', { count: hiddenCount })}
              </li>
            )}
          </ul>
        )}

        {loadingPreview ? (
          <div className="flex h-16 items-center gap-2 rounded bg-[#1f2329] px-3 text-xs text-neutral-500">
            <Loader2 size={14} className="animate-spin" />
            {t('delete.loadingPreview')}
          </div>
        ) : preview ? (
          <ul className="list-inside list-disc space-y-1 rounded border border-[#1f2329] bg-[#0f1114] p-3 text-sm text-neutral-400">
            <li>{t('delete.impactRows', { count: preview.totalRows })}</li>
            {isMany ? (
              <li>{t('delete.impactFolders', { count: preview.foldersToRemove })}</li>
            ) : preview.mods[0]?.folderExists ? (
              <li>{t('delete.impactFolder', { path: preview.mods[0].folderPath })}</li>
            ) : (
              <li>{t('delete.impactFolderMissing')}</li>
            )}
          </ul>
        ) : null}
        <p className="text-xs font-medium text-red-400">{t('delete.irreversible')}</p>
      </div>
    </ModalShell>
  )
}
