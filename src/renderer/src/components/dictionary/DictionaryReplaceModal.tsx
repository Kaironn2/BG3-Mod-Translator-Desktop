import { Replace, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ModalShell } from '@/components/shared/ModalShell'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { cn } from '@/lib/utils'
import { EMPTY_REPLACE_DRAFT, type ReplaceDraft } from './types'

interface DictionaryReplaceModalProps {
  open: boolean
  selectedCount: number
  onClose: () => void
  onSubmit: (draft: ReplaceDraft) => Promise<boolean>
}

export function DictionaryReplaceModal({
  open,
  selectedCount,
  onClose,
  onSubmit
}: DictionaryReplaceModalProps): React.JSX.Element | null {
  const { t } = useAppTranslation(['dictionary', 'common'])
  const [draft, setDraft] = useState<ReplaceDraft>(EMPTY_REPLACE_DRAFT)
  const [saving, setSaving] = useState(false)
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false)

  useEffect(() => {
    if (!open) {
      setDraft(EMPTY_REPLACE_DRAFT)
      setSaving(false)
      setConfirmDiscardOpen(false)
    }
  }, [open])

  const isDirty =
    draft.find !== '' ||
    draft.replaceWith !== '' ||
    draft.scope !== EMPTY_REPLACE_DRAFT.scope ||
    draft.matchCase !== EMPTY_REPLACE_DRAFT.matchCase ||
    draft.matchWholeWord !== EMPTY_REPLACE_DRAFT.matchWholeWord

  const requestClose = () => {
    if (saving) return
    if (isDirty) {
      setConfirmDiscardOpen(true)
      return
    }
    onClose()
  }

  const handleApply = async () => {
    if (!draft.find.trim()) {
      toast.error(t('replaceModal.searchRequired', { ns: 'dictionary' }))
      return
    }

    setSaving(true)
    try {
      const shouldClose = await onSubmit(draft)
      if (shouldClose) onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <ModalShell
        open={open}
        title={t('replaceModal.title', { ns: 'dictionary' })}
        description={t('replaceModal.description', {
          ns: 'dictionary',
          count: selectedCount
        })}
        icon={<Replace size={16} />}
        sizeClassName="max-w-2xl"
        onClose={requestClose}
        footer={
          <>
            <button
              type="button"
              onClick={requestClose}
              className="inline-flex h-8 cursor-pointer items-center rounded-md border border-neutral-700 bg-[#131518] px-3 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-800"
            >
              {t('actions.cancel', { ns: 'common' })}
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={saving}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-amber-500 bg-amber-500 px-3 text-xs font-semibold text-neutral-950 transition-colors hover:border-amber-400 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Search size={13} />
              {saving
                ? t('replaceModal.applying', { ns: 'dictionary' })
                : t('replaceModal.apply', { ns: 'dictionary' })}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={t('replaceModal.find', { ns: 'dictionary' })}>
            <input
              autoFocus
              value={draft.find}
              onChange={(event) => setDraft({ ...draft, find: event.target.value })}
              className="h-10 w-full rounded-md border border-[#252a32] bg-[#0c0d0f] px-3 text-sm text-neutral-200 outline-none transition-colors placeholder:text-neutral-600 focus:border-amber-500"
              placeholder={t('replaceModal.findPlaceholder', { ns: 'dictionary' })}
            />
          </Field>

          <Field label={t('replaceModal.replaceWith', { ns: 'dictionary' })}>
            <input
              value={draft.replaceWith}
              onChange={(event) => setDraft({ ...draft, replaceWith: event.target.value })}
              className="h-10 w-full rounded-md border border-[#252a32] bg-[#0c0d0f] px-3 text-sm text-neutral-200 outline-none transition-colors placeholder:text-neutral-600 focus:border-amber-500"
              placeholder={t('replaceModal.replacePlaceholder', { ns: 'dictionary' })}
            />
          </Field>

          <Field label={t('replaceModal.scope', { ns: 'dictionary' })}>
            <div className="grid grid-cols-3 gap-2">
              <ScopeButton
                active={draft.scope === 'source'}
                label={t('replaceModal.scopeSource', { ns: 'dictionary' })}
                onClick={() => setDraft({ ...draft, scope: 'source' })}
              />
              <ScopeButton
                active={draft.scope === 'target'}
                label={t('replaceModal.scopeTarget', { ns: 'dictionary' })}
                onClick={() => setDraft({ ...draft, scope: 'target' })}
              />
              <ScopeButton
                active={draft.scope === 'both'}
                label={t('replaceModal.scopeBoth', { ns: 'dictionary' })}
                onClick={() => setDraft({ ...draft, scope: 'both' })}
              />
            </div>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <CheckField
              checked={draft.matchCase}
              label={t('replaceModal.matchCase', { ns: 'dictionary' })}
              onChange={(checked) => setDraft({ ...draft, matchCase: checked })}
            />
            <CheckField
              checked={draft.matchWholeWord}
              label={t('replaceModal.matchWholeWord', { ns: 'dictionary' })}
              onChange={(checked) => setDraft({ ...draft, matchWholeWord: checked })}
            />
          </div>
        </div>
      </ModalShell>

      <ConfirmDialog
        open={confirmDiscardOpen}
        title={t('replaceModal.discardTitle', { ns: 'dictionary' })}
        description={t('replaceModal.discardDescription', { ns: 'dictionary' })}
        confirmLabel={t('actions.discard', { ns: 'common' })}
        destructive
        onClose={() => setConfirmDiscardOpen(false)}
        onConfirm={() => {
          setConfirmDiscardOpen(false)
          setDraft(EMPTY_REPLACE_DRAFT)
          onClose()
        }}
      />
    </>
  )
}

function Field({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[10px] font-semibold tracking-[0.08em] text-neutral-500 uppercase">
        {label}
      </span>
      {children}
    </label>
  )
}

function ScopeButton({
  active,
  label,
  onClick
}: {
  active: boolean
  label: string
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-10 cursor-pointer items-center justify-center rounded-md border text-sm transition-colors',
        active
          ? 'border-amber-500 bg-amber-500/10 text-amber-400'
          : 'border-[#252a32] bg-[#0c0d0f] text-neutral-300 hover:border-neutral-600 hover:bg-[#131518]'
      )}
    >
      {label}
    </button>
  )
}

function CheckField({
  checked,
  label,
  onChange
}: {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}): React.JSX.Element {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-[#252a32] bg-[#0c0d0f] px-3 py-2 text-sm text-neutral-200">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 cursor-pointer accent-amber-500"
      />
      {label}
    </label>
  )
}
