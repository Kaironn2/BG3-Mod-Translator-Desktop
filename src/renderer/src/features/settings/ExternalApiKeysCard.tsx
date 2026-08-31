import { Check, Eye, EyeOff, KeyRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { ConfigKey } from '@/types'
import { SettingsSectionCard } from './SettingsSectionCard'
import { useDebouncedPersist } from './useDebouncedPersist'

interface ExternalApiMeta {
  id: 'deepl' | 'google'
  name: string
  mark: string
  color: string
  keyConfigKey: ConfigKey
  keyPlaceholder: string
}

const EXTERNAL_APIS: ExternalApiMeta[] = [
  {
    id: 'deepl',
    name: 'DeepL',
    mark: 'DL',
    color: '#1a4f8b',
    keyConfigKey: 'deepl_key',
    keyPlaceholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx'
  },
  {
    id: 'google',
    name: 'Google Translate',
    mark: 'G',
    color: '#4285f4',
    keyConfigKey: 'google_key',
    keyPlaceholder: 'AIza...'
  }
]

interface ExternalApiKeysCardProps {
  config: Record<string, string>
  set: (key: ConfigKey, value: string) => Promise<void>
}

function ApiKeyRow({
  meta,
  keyValue,
  onSaveKey
}: {
  meta: ExternalApiMeta
  keyValue: string
  onSaveKey: (key: ConfigKey, value: string) => Promise<void>
}): React.JSX.Element {
  const { t } = useAppTranslation(['settings'])
  const [draft, setDraft] = useState(keyValue)
  const [show, setShow] = useState(false)
  const [focused, setFocused] = useState(false)
  const { onInput, flush, lastSavedRef } = useDebouncedPersist((value) => {
    void onSaveKey(meta.keyConfigKey, value)
  })
  const connected = draft.trim().length > 6

  useEffect(() => {
    lastSavedRef.current = keyValue
    if (!focused) setDraft(keyValue)
  }, [focused, keyValue, lastSavedRef])

  return (
    <div className="rounded-lg border border-[#1f2329] bg-[#0f1114]">
      <div className="grid grid-cols-[150px_1fr] items-center gap-3 p-3">
        <div className="flex min-w-0 items-center gap-2.5">
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
              {connected ? t('apiKeys.connected') : t('apiKeys.noKey')}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-1 rounded-md border border-[#1f2329] bg-[#0f1114] px-3 transition-colors focus-within:border-amber-500">
          <input
            type={show ? 'text' : 'password'}
            value={draft}
            placeholder={meta.keyPlaceholder}
            onChange={(event) => {
              setDraft(event.target.value)
              onInput(event.target.value)
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false)
              flush(draft)
            }}
            className="min-w-0 flex-1 bg-transparent py-2 font-mono text-xs text-neutral-200 placeholder-neutral-600 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShow((open) => !open)}
            className="cursor-pointer text-neutral-500 transition-colors hover:text-neutral-300"
            title={show ? t('apiKeys.hideKey') : t('apiKeys.showKey')}
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>
    </div>
  )
}

export function ExternalApiKeysCard({ config, set }: ExternalApiKeysCardProps): React.JSX.Element {
  const { t } = useAppTranslation(['settings'])

  return (
    <SettingsSectionCard
      title={t('sections.apiKeys')}
      subtitle={t('sections.apiKeysSubtitle')}
      icon={<KeyRound size={16} />}
    >
      <div className="flex flex-col gap-2">
        {EXTERNAL_APIS.map((meta) => (
          <ApiKeyRow
            key={meta.id}
            meta={meta}
            keyValue={config[meta.keyConfigKey] ?? ''}
            onSaveKey={set}
          />
        ))}
      </div>
      <div className="mt-3 text-right text-xs text-neutral-500">{t('autoSaved')}</div>
    </SettingsSectionCard>
  )
}
