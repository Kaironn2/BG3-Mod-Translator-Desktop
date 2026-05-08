import { Check, Pencil, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { HighlightedTextarea } from '@/components/shared/HighlightedTextarea'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ModalShell } from '@/components/shared/ModalShell'
import { ThemedSelect } from '@/components/shared/ThemedSelect'
import type { Language } from '@/types'
import { EMPTY_ENTRY_DRAFT, type EntryDraft } from './types'

const META_INPUT =
  'h-9 w-full rounded-md border border-[#252a32] bg-[#0c0d0f] px-3 text-sm text-neutral-200 outline-none transition-colors placeholder:text-neutral-600 focus:border-amber-500'

interface DictionaryEntryModalProps {
  open: boolean
  mode: 'create' | 'edit'
  entryId?: number
  initialDraft: EntryDraft
  languages: Language[]
  mods: string[]
  onClose: () => void
  onSubmit: (draft: EntryDraft) => Promise<boolean>
}

export function DictionaryEntryModal({
  open,
  mode,
  entryId,
  initialDraft,
  languages,
  mods,
  onClose,
  onSubmit
}: DictionaryEntryModalProps): React.JSX.Element | null {
  const [draft, setDraft] = useState<EntryDraft>(initialDraft)
  const [saving, setSaving] = useState(false)
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false)

  useEffect(() => {
    if (!open) {
      setDraft(initialDraft)
      setSaving(false)
      setConfirmDiscardOpen(false)
      return
    }

    setDraft(initialDraft)
  }, [initialDraft, open])

  const languageOptions = useMemo(
    () =>
      languages.map((language) => ({
        value: language.code,
        label: language.name,
        badge: language.code.toUpperCase(),
        searchText: `${language.name} ${language.code}`
      })),
    [languages]
  )

  const isDirty = isDraftDirty(draft, initialDraft)

  const requestClose = () => {
    if (saving) return
    if (isDirty) {
      setConfirmDiscardOpen(true)
      return
    }
    onClose()
  }

  const handleSave = async () => {
    if (!isDraftValid(draft)) {
      toast.error('Preencha idioma 1, idioma 2 e os dois textos')
      return
    }

    setSaving(true)
    try {
      const didSave = await onSubmit(draft)
      if (didSave) onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <ModalShell
        open={open}
        title={mode === 'create' ? 'Nova entrada' : `Editar entrada #${entryId ?? ''}`}
        description={
          mode === 'create'
            ? 'Crie uma nova entrada de dicionario para o par de idiomas atual.'
            : 'Atualize os textos, idiomas e metadados desta entrada.'
        }
        icon={mode === 'create' ? <Plus size={16} /> : <Pencil size={16} />}
        sizeClassName="max-w-4xl"
        onClose={requestClose}
        footer={
          <>
            <button
              type="button"
              onClick={requestClose}
              className="inline-flex h-8 cursor-pointer items-center rounded-md border border-neutral-700 bg-[#131518] px-3 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-amber-500 bg-amber-500 px-3 text-xs font-semibold text-neutral-950 transition-colors hover:border-amber-400 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check size={13} />
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="space-y-4">
            <Field label="Texto idioma 1">
              <HighlightedTextarea
                autoFocus
                value={draft.sourceText}
                onChange={(event) => setDraft({ ...draft, sourceText: event.target.value })}
                rows={6}
                containerClassName="rounded-lg border-[#2a2f37] bg-[#0c0d0f] focus-within:border-amber-500 focus-within:shadow-[0_0_0_3px_rgba(245,158,11,0.22)]"
                overlayClassName="px-3 py-2.5 text-[13px] leading-[1.6]"
                className="min-h-38 px-3 py-2.5 text-[13px] leading-[1.6]"
                placeholder="Texto do idioma 1..."
              />
            </Field>

            <Field label="Texto idioma 2">
              <HighlightedTextarea
                value={draft.targetText}
                onChange={(event) => setDraft({ ...draft, targetText: event.target.value })}
                rows={6}
                containerClassName="rounded-lg border-[#2a2f37] bg-[#0c0d0f] focus-within:border-amber-500 focus-within:shadow-[0_0_0_3px_rgba(245,158,11,0.22)]"
                overlayClassName="px-3 py-2.5 text-[13px] leading-[1.6]"
                className="min-h-38 px-3 py-2.5 text-[13px] leading-[1.6]"
                placeholder="Texto do idioma 2..."
              />
            </Field>
          </div>

          <div className="space-y-4">
            {mode === 'edit' && (
              <div className="rounded-lg border border-[#1f2329] bg-[#0f1114] px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
                  ID
                </div>
                <div className="mt-1 font-mono text-sm text-neutral-200">{entryId}</div>
              </div>
            )}

            <Field label="Idioma 1">
              <ThemedSelect
                value={draft.sourceLang}
                onChange={(value) => setDraft({ ...draft, sourceLang: value })}
                options={languageOptions}
                placeholder="Selecionar idioma"
                searchable
                searchPlaceholder="Buscar idioma..."
                emptyLabel="Nenhum idioma encontrado."
              />
            </Field>

            <Field label="Idioma 2">
              <ThemedSelect
                value={draft.targetLang}
                onChange={(value) => setDraft({ ...draft, targetLang: value })}
                options={languageOptions}
                placeholder="Selecionar idioma"
                searchable
                searchPlaceholder="Buscar idioma..."
                emptyLabel="Nenhum idioma encontrado."
              />
            </Field>

            <Field label="Mod">
              <input
                list="dictionary-modal-mod-options"
                value={draft.modName}
                onChange={(event) => setDraft({ ...draft, modName: event.target.value })}
                className={META_INPUT}
                placeholder="Nome do mod"
              />
              <datalist id="dictionary-modal-mod-options">
                {mods.map((modName) => (
                  <option key={modName} value={modName} />
                ))}
              </datalist>
            </Field>

            <Field label="UID">
              <input
                value={draft.uid}
                onChange={(event) => setDraft({ ...draft, uid: event.target.value })}
                className={META_INPUT}
                placeholder="UID opcional"
              />
            </Field>
          </div>
        </div>
      </ModalShell>

      <ConfirmDialog
        open={confirmDiscardOpen}
        title="Descartar alteracoes?"
        description="Existem alteracoes pendentes nesta entrada. Se continuar, elas serao perdidas."
        confirmLabel="Descartar"
        destructive
        onClose={() => setConfirmDiscardOpen(false)}
        onConfirm={() => {
          setConfirmDiscardOpen(false)
          setDraft(EMPTY_ENTRY_DRAFT)
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
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
        {label}
      </span>
      {children}
    </label>
  )
}

function isDraftDirty(draft: EntryDraft, initialDraft: EntryDraft): boolean {
  return (
    draft.sourceLang !== initialDraft.sourceLang ||
    draft.targetLang !== initialDraft.targetLang ||
    draft.sourceText !== initialDraft.sourceText ||
    draft.targetText !== initialDraft.targetText ||
    draft.modName !== initialDraft.modName ||
    draft.uid !== initialDraft.uid
  )
}

function isDraftValid(draft: EntryDraft): boolean {
  return Boolean(
    draft.sourceLang.trim() &&
      draft.targetLang.trim() &&
      draft.sourceText.trim() &&
      draft.targetText.trim()
  )
}
