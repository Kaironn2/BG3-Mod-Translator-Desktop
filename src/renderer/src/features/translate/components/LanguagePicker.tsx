import { useMemo } from 'react'
import { ThemedSelect } from '@/components/shared/ThemedSelect'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { Language } from '@/types'

interface LanguagePickerProps {
  value: string
  onChange: (code: string) => void
  languages: Language[]
  accent?: boolean
}

export function LanguagePicker({
  value,
  onChange,
  languages,
  accent
}: LanguagePickerProps): React.JSX.Element {
  const { t } = useAppTranslation('common')
  const options = useMemo(
    () =>
      languages.map((language) => ({
        value: language.code,
        label: language.name,
        badge: language.code.toUpperCase(),
        searchText: `${language.name} ${language.code}`
      })),
    [languages]
  )

  return (
    <ThemedSelect
      value={value}
      onChange={onChange}
      options={options}
      placeholder={t('placeholders.select')}
      searchable
      searchPlaceholder={t('placeholders.searchLanguage')}
      emptyLabel={t('placeholders.noLanguageFound')}
      accent={accent}
    />
  )
}
