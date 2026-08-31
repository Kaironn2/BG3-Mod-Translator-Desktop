import { AlertTriangle, Check, Layers, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { PromptEditor } from '@/components/shared/PromptEditor'
import { useAISettings } from '@/hooks/useAISettings'
import { usePromptSlots } from '@/hooks/usePromptSlots'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import {
  missingPromptVars,
  REQUIRED_PROMPT_VARS,
  reservedPromptHeadings,
  unknownPromptVars
} from '@/types'
import { SettingsSectionCard } from './SettingsSectionCard'

function VarChecklist({ prompt }: { prompt: string }): React.JSX.Element {
  // Derive from the same validators used to gate saving, so badges and validation can't drift.
  const missing = new Set(missingPromptVars(prompt))
  const unknown = unknownPromptVars(prompt)
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {REQUIRED_PROMPT_VARS.map((v) => {
        const present = !missing.has(v)
        return (
          <span
            key={v}
            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[11px] ${
              present
                ? 'bg-amber-500/12 text-amber-400'
                : 'border border-red-500/30 bg-red-500/10 text-red-400'
            }`}
          >
            {present ? <Check size={11} /> : <AlertTriangle size={11} />}
            {`{${v}}`}
          </span>
        )
      })}
      {unknown.map((v) => (
        <span
          key={`unknown-${v}`}
          className="inline-flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 font-mono text-[11px] text-red-400 line-through"
        >
          <AlertTriangle size={11} />
          {`{${v}}`}
        </span>
      ))}
    </div>
  )
}

function PromptTip(): React.JSX.Element {
  const { t } = useAppTranslation(['ai'])
  return (
    <span className="group relative inline-flex">
      <span className="inline-flex h-4.5 w-4.5 cursor-help items-center justify-center rounded-full border border-neutral-500 font-mono text-[11px] font-bold text-neutral-400">
        ?
      </span>
      <span className="pointer-events-none absolute top-[calc(100%+8px)] left-1/2 z-50 w-80 -translate-x-1/2 rounded-lg border border-[#1f2329] bg-[#131518] px-3.5 py-3 text-xs leading-relaxed text-neutral-300 opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
        {t('slots.tooltip.text')}
        <span className="mt-2 block rounded-md border border-[#1f2329] bg-[#0f1114] px-2.5 py-2 font-mono whitespace-pre-wrap text-neutral-400">
          {t('slots.tooltip.example')}
        </span>
      </span>
    </span>
  )
}

export function PromptSlotsCard(): React.JSX.Element {
  const { t } = useAppTranslation(['ai', 'common', 'toasts'])
  const { slots, create, update, remove } = usePromptSlots()
  const { activePromptSlotId, set, loading: configLoading } = useAISettings()

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [dirty, setDirty] = useState(false)
  const [naming, setNaming] = useState(false)
  const [nameVal, setNameVal] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)
  // confirmName fires from both Enter and the input's blur (which follows the unmount after
  // Enter) - this ref makes sure only one slot is created per naming session.
  const nameSubmittedRef = useRef(false)

  const defaultSlot = slots.find((s) => s.isDefault)

  useEffect(() => {
    if (naming) nameInputRef.current?.focus()
  }, [naming])

  // Initialise selection once slots and config have loaded.
  useEffect(() => {
    if (configLoading || slots.length === 0 || selectedId !== null) return
    const preferred =
      activePromptSlotId && slots.some((s) => s.id === activePromptSlotId)
        ? activePromptSlotId
        : (defaultSlot?.id ?? slots[0].id)
    setSelectedId(preferred)
    setDraft(slots.find((s) => s.id === preferred)?.prompt ?? '')
  }, [configLoading, slots, selectedId, activePromptSlotId, defaultSlot])

  const current = slots.find((s) => s.id === selectedId) ?? null
  const isLocked = current?.isDefault ?? false
  const missing = missingPromptVars(draft)
  const unknown = unknownPromptVars(draft)
  const reserved = reservedPromptHeadings(draft)
  // Live validation: the alert, the editor's red border and the disabled save button all
  // react to every keystroke instead of waiting for a save attempt.
  const varsInvalid = missing.length > 0 || unknown.length > 0 || reserved.length > 0
  const showVarsError = !isLocked && varsInvalid

  const selectSlot = (id: number, prompt: string): void => {
    setSelectedId(id)
    setDraft(prompt)
    setDirty(false)
    void set('ai_active_prompt_slot', String(id))
  }

  const pickSlot = (id: number): void => {
    const slot = slots.find((s) => s.id === id)
    if (slot) selectSlot(id, slot.prompt)
  }

  const forkDefault = async (): Promise<void> => {
    try {
      const slot = await create(t('slots.copyName'), draft)
      selectSlot(slot.id, slot.prompt)
    } catch (err) {
      toast.error(getLocalizedErrorMessage(err, t))
    }
  }

  const openNaming = (): void => {
    nameSubmittedRef.current = false
    setNameVal('')
    setNaming(true)
  }

  const cancelNaming = (): void => {
    nameSubmittedRef.current = true
    setNaming(false)
    setNameVal('')
  }

  const confirmName = async (): Promise<void> => {
    if (nameSubmittedRef.current) return
    nameSubmittedRef.current = true
    const name = nameVal.trim() || t('slots.newSlotName')
    const seed = defaultSlot?.prompt ?? draft
    setNaming(false)
    setNameVal('')
    try {
      const slot = await create(name, seed)
      selectSlot(slot.id, slot.prompt)
    } catch (err) {
      toast.error(getLocalizedErrorMessage(err, t))
    }
  }

  const saveSlot = async (): Promise<void> => {
    if (selectedId === null || varsInvalid) return
    try {
      await update(selectedId, { prompt: draft })
      setDirty(false)
      toast.success(t('ai.promptSaved', { ns: 'toasts' }))
    } catch (err) {
      toast.error(getLocalizedErrorMessage(err, t))
    }
  }

  const deleteSlot = async (): Promise<void> => {
    if (selectedId === null) return
    try {
      await remove(selectedId)
      if (defaultSlot) selectSlot(defaultSlot.id, defaultSlot.prompt)
    } catch (err) {
      toast.error(getLocalizedErrorMessage(err, t))
    }
  }

  const onDraft = (value: string): void => {
    setDraft(value)
    setDirty(true)
  }

  return (
    <SettingsSectionCard
      title={t('slots.title')}
      subtitle={t('slots.subtitle')}
      icon={<Layers size={16} />}
    >
      {/* slot bar */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {slots.map((slot) => (
          <button
            key={slot.id}
            type="button"
            onClick={() => pickSlot(slot.id)}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors ${
              selectedId === slot.id
                ? 'border-amber-500/60 bg-amber-500/10 text-amber-400'
                : 'border-[#1f2329] bg-[#0f1114] text-neutral-300 hover:border-[#252a32]'
            }`}
          >
            <span className="font-mono text-[10px] text-neutral-500">
              {`P${String(slot.id).padStart(2, '0')}`}
            </span>
            {slot.name}
            {slot.isDefault && <Lock size={11} />}
          </button>
        ))}
        {naming ? (
          <input
            ref={nameInputRef}
            value={nameVal}
            placeholder={t('slots.namePlaceholder')}
            onChange={(e) => setNameVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void confirmName()
              if (e.key === 'Escape') cancelNaming()
            }}
            onBlur={() => void confirmName()}
            className="w-44 rounded-md border border-amber-500 bg-[#0f1114] px-2.5 py-1.5 text-sm text-neutral-200 focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={openNaming}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-neutral-600 px-2.5 py-1.5 text-sm text-neutral-400 transition-colors hover:border-amber-500 hover:text-amber-400"
          >
            <Plus size={13} /> {t('slots.newSlot')}
          </button>
        )}
      </div>

      <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">
        {isLocked ? t('slots.defaultReadOnly') : t('slots.editing', { name: current?.name ?? '' })}
        <PromptTip />
      </div>

      <PromptEditor value={draft} onChange={onDraft} readOnly={isLocked} error={showVarsError} />

      <VarChecklist prompt={draft} />

      {showVarsError && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-sm text-red-300">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-red-400" />
          <div className="flex flex-col gap-0.5">
            <strong>{t('slots.cannotSave')}</strong>
            {missing.length > 0 && (
              <span>
                {t('slots.missingVarsError', { vars: missing.map((v) => `{${v}}`).join(', ') })}
              </span>
            )}
            {unknown.length > 0 && (
              <span>
                {t('slots.unknownVarsError', { vars: unknown.map((v) => `{${v}}`).join(', ') })}
              </span>
            )}
            {reserved.length > 0 && (
              <span>{t('slots.reservedError', { sections: reserved.join(', ') })}</span>
            )}
          </div>
        </div>
      )}

      {isLocked && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-sm text-neutral-300">
          <Lock size={14} className="mt-0.5 shrink-0 text-amber-400" />
          <div>{t('slots.lockedNotice')}</div>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2.5">
        {isLocked ? (
          <button
            type="button"
            onClick={() => void forkDefault()}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-amber-500/90 px-4 py-2 text-sm font-medium text-neutral-950 transition-colors hover:bg-amber-500"
          >
            <Pencil size={13} /> {t('slots.editCreateCopy')}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void saveSlot()}
              disabled={!dirty || varsInvalid}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-amber-500/90 px-4 py-2 text-sm font-medium text-neutral-950 transition-colors hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check size={13} /> {t('slots.save')}
            </button>
            <button
              type="button"
              onClick={() => void deleteSlot()}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#1f2329] bg-[#0f1114] px-4 py-2 text-sm text-neutral-300 transition-colors hover:border-[#252a32]"
            >
              <Trash2 size={13} /> {t('slots.delete')}
            </button>
          </>
        )}
        <span className="ml-auto text-xs">
          {!varsInvalid ? (
            <span className="text-amber-400">{t('slots.allVarsPresent')}</span>
          ) : missing.length > 0 ? (
            <span className="text-neutral-500">
              {t('slots.missingCount', { count: missing.length })}
            </span>
          ) : unknown.length > 0 ? (
            <span className="text-neutral-500">
              {t('slots.unknownCount', { count: unknown.length })}
            </span>
          ) : (
            <span className="text-neutral-500">
              {t('slots.reservedCount', { count: reserved.length })}
            </span>
          )}
        </span>
      </div>
    </SettingsSectionCard>
  )
}
