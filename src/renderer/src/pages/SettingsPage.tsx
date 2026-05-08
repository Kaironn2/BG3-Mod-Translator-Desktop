import { useEffect, useState } from 'react'
import { Copy, FolderOpen, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ThemedSelect } from '@/components/shared/ThemedSelect'
import { useConfig } from '@/hooks/useConfig'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { i18n } from '@/i18n'
import { defaultLanguage, languageLabels, supportedLanguages } from '@/i18n/languages'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { ConfigKey } from '@/types'

interface SettingFieldProps {
  label: string
  configKey: ConfigKey
  value: string
  onSave: (key: ConfigKey, value: string) => Promise<void>
  type?: string
  placeholder?: string
  saveLabel: string
  savedLabel: string
  successMessage: string
}

function SettingField({
  label,
  configKey,
  value,
  onSave,
  type = 'text',
  placeholder,
  saveLabel,
  savedLabel,
  successMessage
}: SettingFieldProps) {
  const [draft, setDraft] = useState(value)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    await onSave(configKey, draft)
    setSaved(true)
    toast.success(successMessage)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-neutral-400">{label}</label>
      <div className="flex gap-2">
        <input
          type={type}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setSaved(false)
          }}
          placeholder={placeholder}
          className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:border-neutral-500 focus:outline-none"
        />
        <button
          onClick={handleSave}
          className="rounded-md bg-neutral-800 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-700"
        >
          {saved ? savedLabel : saveLabel}
        </button>
      </div>
    </div>
  )
}

export function SettingsPage(): React.JSX.Element {
  const { config, loading, set } = useConfig()
  const [logPath, setLogPath] = useState('')
  const { t } = useAppTranslation(['settings', 'common', 'toasts'])

  useEffect(() => {
    window.api.log.getPath().then(setLogPath)
  }, [])

  const handleOpenLog = async () => {
    try {
      await window.api.log.open()
    } catch (err) {
      toast.error(getLocalizedErrorMessage(err, t))
    }
  }

  const handleCopyLogPath = async () => {
    try {
      await navigator.clipboard.writeText(logPath)
      toast.success(t('settings.logPathCopied', { ns: 'toasts' }))
    } catch (err) {
      toast.error(getLocalizedErrorMessage(err, t))
    }
  }

  const handleClearLog = async () => {
    try {
      await window.api.log.clear()
      toast.success(t('settings.logCleared', { ns: 'toasts' }))
    } catch (err) {
      toast.error(getLocalizedErrorMessage(err, t))
    }
  }

  const handleLanguageChange = async (language: string) => {
    await set('app_language', language)
    await i18n.changeLanguage(language)
  }

  if (loading) {
    return <div className="p-6 text-sm text-neutral-500">{t('loading', { ns: 'common' })}</div>
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold text-neutral-100">{t('title')}</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-neutral-300">{t('sections.apiKeys')}</h2>
        {/* <SettingField
          label="OpenAI API Key"
          configKey="openai_key"
          value={config['openai_key'] ?? ''}
          onSave={set}
          type="password"
          placeholder="sk-..."
        /> */}
        <SettingField
          label={t('fields.deeplKey')}
          configKey="deepl_key"
          value={config['deepl_key'] ?? ''}
          onSave={set}
          type="password"
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx"
          saveLabel={t('buttons.save')}
          savedLabel={t('buttons.saved')}
          successMessage={t('settings.saved', {
            ns: 'toasts',
            label: t('fields.deeplKey')
          })}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-neutral-300">{t('sections.language')}</h2>
        <div className="flex max-w-sm flex-col gap-1">
          <label className="text-xs text-neutral-400">{t('fields.appLanguage')}</label>
          <ThemedSelect
            value={config['app_language'] || defaultLanguage}
            onChange={(value) => {
              void handleLanguageChange(value)
            }}
            options={supportedLanguages.map((language) => ({
              value: language,
              label: languageLabels[language]
            }))}
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-neutral-300">{t('sections.defaults')}</h2>
        <SettingField
          label={t('fields.defaultAuthor')}
          configKey="author"
          value={config['author'] ?? ''}
          onSave={set}
          placeholder={t('placeholders.author')}
          saveLabel={t('buttons.save')}
          savedLabel={t('buttons.saved')}
          successMessage={t('settings.saved', {
            ns: 'toasts',
            label: t('fields.defaultAuthor')
          })}
        />
        <SettingField
          label={t('fields.defaultSourceLanguage')}
          configKey="last_source_lang"
          value={config['last_source_lang'] ?? ''}
          onSave={set}
          placeholder={t('placeholders.sourceLanguage')}
          saveLabel={t('buttons.save')}
          savedLabel={t('buttons.saved')}
          successMessage={t('settings.saved', {
            ns: 'toasts',
            label: t('fields.defaultSourceLanguage')
          })}
        />
        <SettingField
          label={t('fields.defaultTargetLanguage')}
          configKey="last_target_lang"
          value={config['last_target_lang'] ?? ''}
          onSave={set}
          placeholder={t('placeholders.targetLanguage')}
          saveLabel={t('buttons.save')}
          savedLabel={t('buttons.saved')}
          successMessage={t('settings.saved', {
            ns: 'toasts',
            label: t('fields.defaultTargetLanguage')
          })}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-neutral-300">{t('sections.tools')}</h2>
        <SettingField
          label={t('fields.divinePath')}
          configKey="divine_path"
          value={config['divine_path'] ?? ''}
          onSave={set}
          placeholder={t('placeholders.divinePath')}
          saveLabel={t('buttons.save')}
          savedLabel={t('buttons.saved')}
          successMessage={t('settings.saved', {
            ns: 'toasts',
            label: t('fields.divinePath')
          })}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-neutral-300">{t('sections.debugLogs')}</h2>
        <div className="rounded-md border border-neutral-800 bg-neutral-900/60 p-3">
          <p className="font-mono text-xs text-neutral-400 break-all">{logPath}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleOpenLog}
              className="inline-flex items-center gap-2 rounded-md bg-neutral-800 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700"
            >
              <FolderOpen size={15} />
              {t('actions.open', { ns: 'common' })}
            </button>
            <button
              type="button"
              onClick={handleCopyLogPath}
              className="inline-flex items-center gap-2 rounded-md bg-neutral-800 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700"
            >
              <Copy size={15} />
              {t('actions.copyPath', { ns: 'common' })}
            </button>
            <button
              type="button"
              onClick={handleClearLog}
              className="inline-flex items-center gap-2 rounded-md border border-red-900/70 bg-red-950/40 px-3 py-2 text-sm text-red-300 hover:bg-red-950"
            >
              <Trash2 size={15} />
              {t('actions.clear', { ns: 'common' })}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
