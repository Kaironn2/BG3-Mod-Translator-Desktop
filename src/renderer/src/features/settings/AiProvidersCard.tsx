import { Check, ChevronDown, Eye, EyeOff, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ThemedSelect } from '@/components/shared/ThemedSelect'
import { useAISettings } from '@/hooks/useAISettings'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { AiProviderId, ConfigKey } from '@/types'
import { AI_TUNING_RANGE } from '@/types'
import {
  AI_PROVIDERS,
  type AiProviderMeta,
  BATCH_LINES_KEYS,
  CONCURRENCY_KEYS,
  getProviderMeta
} from './aiProviders'
import { SettingsSectionCard } from './SettingsSectionCard'

const KEY_SAVE_DEBOUNCE_MS = 600

interface ProviderRowProps {
  meta: AiProviderMeta
  active: boolean
  keyValue: string
  model: string
  concurrency: number
  batchLines: number
  onSelect: () => void
  onSaveKey: (key: ConfigKey, value: string) => Promise<void>
  onSaveModel: (value: string) => void
  onSaveConcurrency: (value: number) => void
  onSaveBatchLines: (value: number) => void
}

function Stepper({
  value,
  min,
  max,
  onChange
}: {
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}): React.JSX.Element {
  const [draft, setDraft] = useState(String(value))

  useEffect(() => {
    setDraft(String(value))
  }, [value])

  const commit = (raw: string): void => {
    const parsed = Number.parseInt(raw, 10)
    if (!Number.isFinite(parsed)) {
      setDraft(String(value))
      return
    }
    const next = Math.min(max, Math.max(min, parsed))
    setDraft(String(next))
    if (next !== value) onChange(next)
  }

  return (
    <div className="inline-flex items-center overflow-hidden rounded-md border border-[#1f2329] bg-[#0f1114]">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        className="flex h-8 w-7 cursor-pointer items-center justify-center text-neutral-300 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:text-neutral-600"
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        aria-valuemin={min}
        aria-valuemax={max}
        onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ''))}
        onBlur={() => commit(draft)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
        className="h-8 w-12 border-x border-[#1f2329] bg-transparent text-center font-mono text-sm text-neutral-200 tabular-nums focus:outline-none"
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        className="flex h-8 w-7 cursor-pointer items-center justify-center text-neutral-300 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:text-neutral-600"
      >
        +
      </button>
    </div>
  )
}

function ProviderRow({
  meta,
  active,
  keyValue,
  model,
  concurrency,
  batchLines,
  onSelect,
  onSaveKey,
  onSaveModel,
  onSaveConcurrency,
  onSaveBatchLines
}: ProviderRowProps): React.JSX.Element {
  const { t } = useAppTranslation(['ai'])
  const [draft, setDraft] = useState(keyValue)
  const [show, setShow] = useState(false)
  const [focused, setFocused] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const timerRef = useRef<number | null>(null)
  const lastSavedRef = useRef(keyValue)
  const connected = draft.trim().length > 6
  const modelOptions = meta.models.includes(model)
    ? meta.models
    : [model, ...meta.models.filter((m) => m !== model)]

  useEffect(() => {
    if (!focused && timerRef.current === null) {
      setDraft(keyValue)
      lastSavedRef.current = keyValue
    }
  }, [keyValue, focused])

  const persist = (value: string): void => {
    const trimmed = value.trim()
    if (trimmed === lastSavedRef.current) return
    lastSavedRef.current = trimmed
    void onSaveKey(meta.keyConfigKey, trimmed)
  }

  const onKeyInput = (value: string): void => {
    setDraft(value)
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => persist(value), KEY_SAVE_DEBOUNCE_MS)
  }

  const flush = (): void => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    persist(draft)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <div
      className={`rounded-lg border transition-colors ${
        active ? 'border-amber-500/60 bg-amber-500/5' : 'border-[#1f2329] bg-[#0f1114]'
      }`}
    >
      <div className="grid grid-cols-[18px_150px_1fr_minmax(140px,180px)_28px] items-center gap-3 p-3">
        <button
          type="button"
          onClick={onSelect}
          title={t('providers.useThis')}
          className={`flex h-4.5 w-4.5 cursor-pointer items-center justify-center rounded-full border transition-colors ${
            active ? 'border-amber-500' : 'border-neutral-500 hover:border-neutral-300'
          }`}
        >
          {active && <span className="h-2 w-2 rounded-full bg-amber-500" />}
        </button>

        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="flex min-w-0 cursor-pointer items-center gap-2.5 text-left"
        >
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-bold text-white"
            style={{ background: meta.color }}
          >
            {meta.mark}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-neutral-200">{meta.name}</div>
            <div
              className={`flex items-center gap-1 text-[10px] ${connected ? 'text-amber-400' : 'text-neutral-500'}`}
            >
              {connected && <Check size={10} />}
              {connected ? t('providers.connected') : t('providers.noKey')}
            </div>
          </div>
        </button>

        <div className="flex min-w-0 items-center gap-1 rounded-md border border-[#1f2329] bg-[#0f1114] px-3 transition-colors focus-within:border-amber-500">
          <input
            type={show ? 'text' : 'password'}
            value={draft}
            placeholder={`${meta.name} API key`}
            onChange={(e) => onKeyInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false)
              flush()
            }}
            className="min-w-0 flex-1 bg-transparent py-2 font-mono text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="cursor-pointer text-neutral-500 transition-colors hover:text-neutral-300"
            title={show ? t('providers.hideKey') : t('providers.showKey')}
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>

        <ThemedSelect
          value={model}
          onChange={onSaveModel}
          searchable
          options={modelOptions.map((m) => ({ value: m, label: m }))}
        />

        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          title={expanded ? t('providers.collapse') : t('providers.expand')}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-amber-500 transition-colors hover:bg-amber-500/10 hover:text-amber-400"
        >
          <ChevronDown
            size={16}
            className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {expanded ? (
        <div className="space-y-3 border-t border-[#1f2329] px-3 py-3">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-neutral-400">{t('providers.concurrency')}</span>
              <Stepper
                value={concurrency}
                min={AI_TUNING_RANGE.concurrency.min}
                max={AI_TUNING_RANGE.concurrency.max}
                onChange={onSaveConcurrency}
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-neutral-400">{t('providers.batchLines')}</span>
              <Stepper
                value={batchLines}
                min={AI_TUNING_RANGE.batchLines.min}
                max={AI_TUNING_RANGE.batchLines.max}
                onChange={onSaveBatchLines}
              />
            </div>
          </div>
          <div className="text-[11px] leading-relaxed text-neutral-500">
            <div className="mb-1 font-medium text-neutral-400">{t('providers.tips.title')}</div>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>
                <span className="text-neutral-400">{t('providers.tips.free')}</span>
                {' — '}
                {t(`providers.tips.${meta.id}.free`)}
              </li>
              <li>
                <span className="text-neutral-400">{t('providers.tips.paid')}</span>
                {' — '}
                {t(`providers.tips.${meta.id}.paid`)}
              </li>
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function AiProvidersCard(): React.JSX.Element {
  const { t } = useAppTranslation(['ai'])
  const { set, provider, modelFor, keyFor, concurrencyFor, batchLinesFor } = useAISettings()

  const selectProvider = (id: AiProviderId): void => {
    void set('ai_provider', id)
  }

  return (
    <SettingsSectionCard
      title={t('providers.title')}
      subtitle={t('providers.subtitle')}
      icon={<Sparkles size={16} />}
    >
      <div className="flex flex-col gap-2">
        {AI_PROVIDERS.map((meta) => (
          <ProviderRow
            key={meta.id}
            meta={meta}
            active={provider === meta.id}
            keyValue={keyFor(meta.id)}
            model={modelFor(meta.id)}
            concurrency={concurrencyFor(meta.id)}
            batchLines={batchLinesFor(meta.id)}
            onSelect={() => selectProvider(meta.id)}
            onSaveKey={set}
            onSaveModel={(value) => void set(meta.modelConfigKey, value)}
            onSaveConcurrency={(value) => void set(CONCURRENCY_KEYS[meta.id], String(value))}
            onSaveBatchLines={(value) => void set(BATCH_LINES_KEYS[meta.id], String(value))}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-neutral-500">
        <span className="flex items-center gap-1.5">
          <Check size={12} className="text-amber-500" />
          {t('providers.activeHint', {
            provider: getProviderMeta(provider).name,
            model: modelFor(provider)
          })}
        </span>
        <span>{t('providers.autoSaved')}</span>
      </div>
    </SettingsSectionCard>
  )
}
