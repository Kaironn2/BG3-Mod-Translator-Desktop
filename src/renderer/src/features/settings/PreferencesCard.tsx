import { Languages } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { LanguageSelect } from '@/components/shared/LanguageSelect'
import { ThemedSelect } from '@/components/shared/ThemedSelect'
import { i18n } from '@/i18n'
import { defaultLanguage, languageLabels, supportedLanguages } from '@/i18n/languages'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { ConfigKey } from '@/types'
import { SettingsSectionCard } from './SettingsSectionCard'
import { useDebouncedPersist } from './useDebouncedPersist'

interface PreferencesCardProps {
  config: Record<string, string>
  set: (key: ConfigKey, value: string) => Promise<void>
}

function AutosaveTextField({
  label,
  value,
  placeholder,
  onSave
}: {
  label: string
  value: string
  placeholder?: string
  onSave: (value: string) => void
}): React.JSX.Element {
  const [draft, setDraft] = useState(value)
  const [focused, setFocused] = useState(false)
  const { onInput, flush, lastSavedRef } = useDebouncedPersist(onSave)

  useEffect(() => {
    lastSavedRef.current = value
    if (!focused) setDraft(value)
  }, [focused, lastSavedRef, value])

  return (
    <label className="flex w-full flex-col gap-1">
      <span className="text-xs text-neutral-400">{label}</span>
      <input
        type="text"
        value={draft}
        placeholder={placeholder}
        onChange={(event) => {
          setDraft(event.target.value)
          onInput(event.target.value)
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          flush(draft)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
        className="rounded-md border border-neutral-800 bg-[#0a0a0c] px-3 py-2.5 text-sm text-neutral-200 placeholder-neutral-600 transition-all focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 focus:outline-none"
      />
    </label>
  )
}

export function PreferencesCard({ config, set }: PreferencesCardProps): React.JSX.Element {
  const { t } = useAppTranslation(['settings', 'toasts'])

  const handleLanguageChange = async (language: string): Promise<void> => {
    await set('app_language', language)
    await i18n.changeLanguage(language)
  }

  const handleDefaultLanguageChange = async (
    key: ConfigKey,
    code: string,
    label: string
  ): Promise<void> => {
    await set(key, code)
    toast.success(t('settings.saved', { ns: 'toasts', label }))
  }

  return (
    <SettingsSectionCard
      title={t('sections.preferences')}
      subtitle={t('sections.preferencesSubtitle')}
      icon={<Languages size={16} />}
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <ThemedSelect
          label={t('fields.appLanguage')}
          className="w-full"
          value={config.app_language || defaultLanguage}
          onChange={(value) => {
            void handleLanguageChange(value)
          }}
          options={supportedLanguages.map((language) => ({
            value: language,
            label: languageLabels[language]
          }))}
        />

        <AutosaveTextField
          label={t('fields.defaultAuthor')}
          value={config.author ?? ''}
          placeholder={t('placeholders.author')}
          onSave={(value) => {
            void set('author', value)
          }}
        />

        <LanguageSelect
          label={t('fields.defaultSourceLanguage')}
          value={config.last_source_lang ?? ''}
          onChange={(code) => {
            void handleDefaultLanguageChange(
              'last_source_lang',
              code,
              t('fields.defaultSourceLanguage')
            )
          }}
          className="w-full"
        />
        <LanguageSelect
          label={t('fields.defaultTargetLanguage')}
          value={config.last_target_lang ?? ''}
          onChange={(code) => {
            void handleDefaultLanguageChange(
              'last_target_lang',
              code,
              t('fields.defaultTargetLanguage')
            )
          }}
          className="w-full"
        />
      </div>
      <div className="mt-4 text-right text-xs text-neutral-500">{t('autoSaved')}</div>
    </SettingsSectionCard>
  )
}
