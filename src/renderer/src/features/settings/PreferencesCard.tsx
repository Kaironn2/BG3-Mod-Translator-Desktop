import { Languages } from 'lucide-react'
import { ThemedSelect } from '@/components/shared/ThemedSelect'
import { i18n } from '@/i18n'
import { defaultLanguage, languageLabels, supportedLanguages } from '@/i18n/languages'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { ConfigKey } from '@/types'
import { SettingsSectionCard } from './SettingsSectionCard'

interface PreferencesCardProps {
  config: Record<string, string>
  set: (key: ConfigKey, value: string) => Promise<void>
}

export function PreferencesCard({ config, set }: PreferencesCardProps): React.JSX.Element {
  const { t } = useAppTranslation(['settings', 'toasts'])

  const handleLanguageChange = async (language: string): Promise<void> => {
    await set('app_language', language)
    await i18n.changeLanguage(language)
  }

  return (
    <SettingsSectionCard
      title={t('sections.preferences')}
      subtitle={t('sections.preferencesSubtitle')}
      icon={<Languages size={16} />}
    >
      <div className="grid grid-cols-1 gap-5">
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
      </div>
    </SettingsSectionCard>
  )
}