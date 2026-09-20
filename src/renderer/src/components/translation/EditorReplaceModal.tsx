import { Replace } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { ReplaceDraft } from '@/components/dictionary/types'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ModalShell } from '@/components/shared/ModalShell'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { cn } from '@/lib/utils'

export type EditorReplaceDraft = ReplaceDraft

export interface EditorReplaceScopeInfo {
  kind: 'selection' | 'filter' | 'all'
  entryCount: number
}

interface EditorReplaceModalProps {
  open: boolean
  scope: EditorReplaceScopeInfo
  targetLang: string
  initialMatchCase: boolean
  initialWholeWord: boolean
  onClose: () => void
  onSubmit: (draft: EditorReplaceDraft) => Promise<boolean>
}

const EMPTY_EDITOR_REPLACE: EditorReplaceDraft = {
  find: '',
  replaceWith: '',
  scope: 'target',
  matchCase: false,
  matchWholeWord: false
}

export function EditorReplaceModal({
  open,
  scope,
  targetLang,
  initialMatchCase,
  initialWholeWord,
  onClose,
  onSubmit
}: EditorReplaceModalProps): React.JSX.Element | null {
  const { t } = useAppTranslation(['translate', 'common'])
  const [draft, setDraft] = useState<EditorReplaceDraft>(EMPTY_EDITOR_REPLACE)
  const [saving, setSaving] = useState(false)
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false)
  const findInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setDraft({
        ...EMPTY_EDITOR_REPLACE,
        matchCase: initialMatchCase,
        matchWholeWord: initialWholeWord
      })
      findInputRef.current?.focus()
      return
    }
    setDraft(EMPTY_EDITOR_REPLACE)
    setSaving(false)
    setConfirmDiscardOpen(false)
  }, [open, initialMatchCase, initialWholeWord])

  const isDirty =
    draft.find !== '' ||
    draft.replaceWith !== '' ||
    draft.matchCase !== initialMatchCase ||
    draft.matchWholeWord !== initialWholeWord

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
      toast.error(t('replaceModal.searchRequired', { ns: 'translate' }))
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

  const scopeDescription =
    scope.kind === 'selection'
      ? t('replaceModal.scopeSelected', { ns: 'translate', count: scope.entryCount })
      : scope.kind === 'filter'
        ? t('replaceModal.scopeFiltered', { ns: 'translate', count: scope.entryCount })
        : t('replaceModal.scopeAll', { ns: 'translate', count: scope.entryCount })

  return (
    <>
      <ModalShell
        open={open}
        title={t('replaceModal.title', { ns: 'translate' })}
        description={t('replaceModal.description', {
          ns: 'translate',
          language: targetLang.toUpperCase(),
          scope: scopeDescription
        })}
        icon={<Replace size={16} />}
        sizeClassName="max-w-xl"
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
              onClick={() => void handleApply()}
              disabled={saving}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-amber-500 bg-amber-500 px-3 text-xs font-semibold text-neutral-950 transition-colors hover:border-amber-400 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Replace size={13} />
              {saving
                ? t('replaceModal.applying', { ns: 'translate' })
                : t('replaceModal.apply', { ns: 'translate' })}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-2">
            <span className="text-[10px] font-semibold tracking-[0.08em] text-neutral-500 uppercase">
              {t('replaceModal.find', { ns: 'translate' })}
            </span>
            <input
              ref={findInputRef}
              value={draft.find}
              onChange={(event) => setDraft({ ...draft, find: event.target.value })}
              className="h-10 w-full rounded-md border border-[#252a32] bg-[#0c0d0f] px-3 text-sm text-neutral-200 outline-none transition-colors placeholder:text-neutral-600 focus:border-amber-500"
              placeholder={t('replaceModal.findPlaceholder', { ns: 'translate' })}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-[10px] font-semibold tracking-[0.08em] text-neutral-500 uppercase">
              {t('replaceModal.replaceWith', { ns: 'translate' })}
            </span>
            <input
              value={draft.replaceWith}
              onChange={(event) => setDraft({ ...draft, replaceWith: event.target.value })}
              className="h-10 w-full rounded-md border border-[#252a32] bg-[#0c0d0f] px-3 text-sm text-neutral-200 outline-none transition-colors placeholder:text-neutral-600 focus:border-amber-500"
              placeholder={t('replaceModal.replacePlaceholder', { ns: 'translate' })}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <CheckField
              checked={draft.matchCase}
              label={t('replaceModal.matchCase', { ns: 'translate' })}
              onChange={(checked) => setDraft({ ...draft, matchCase: checked })}
            />
            <CheckField
              checked={draft.matchWholeWord}
              label={t('replaceModal.matchWholeWord', { ns: 'translate' })}
              onChange={(checked) => setDraft({ ...draft, matchWholeWord: checked })}
            />
          </div>

          <div className="rounded-md border border-[#252a32] bg-[#0c0d0f] px-3 py-2.5 text-xs text-neutral-400">
            {t('replaceModal.targetHint', { ns: 'translate', language: targetLang.toUpperCase() })}
          </div>
        </div>
      </ModalShell>

      <ConfirmDialog
        open={confirmDiscardOpen}
        title={t('replaceModal.discardTitle', { ns: 'translate' })}
        description={t('replaceModal.discardDescription', { ns: 'translate' })}
        confirmLabel={t('actions.discard', { ns: 'common' })}
        destructive
        onClose={() => setConfirmDiscardOpen(false)}
        onConfirm={() => {
          setConfirmDiscardOpen(false)
          setDraft(EMPTY_EDITOR_REPLACE)
          onClose()
        }}
      />
    </>
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
    <label
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
        checked
          ? 'border-amber-500/60 bg-amber-500/8 text-amber-200'
          : 'border-[#252a32] bg-[#0c0d0f] text-neutral-200'
      )}
    >
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
