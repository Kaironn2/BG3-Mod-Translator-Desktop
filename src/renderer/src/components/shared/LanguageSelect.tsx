import { useEffect, useState } from 'react'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { ThemedSelect } from '@/components/shared/ThemedSelect'
import type { Language } from '@/types'

interface LanguageSelectProps {
  value: string
  onChange: (code: string) => void
  label?: string
  className?: string
}

export function LanguageSelect({
  value,
  onChange,
  label,
  className
}: LanguageSelectProps): React.JSX.Element {
  const [languages, setLanguages] = useState<Language[]>([])
  const { t } = useAppTranslation('common')

  useEffect(() => {
    window.api.language.getAll().then(setLanguages)
  }, [])

  return (
    <ThemedSelect
      value={value}
      onChange={onChange}
      label={label}
      className={className}
      placeholder={t('placeholders.select')}
      searchable
      searchPlaceholder={t('placeholders.searchLanguage')}
      emptyLabel={t('placeholders.noLanguageFound')}
      options={languages.map((language) => ({
        value: language.code,
        label: language.name,
        badge: language.code.toUpperCase(),
        searchText: `${language.name} ${language.code}`
      }))}
    />
  )
}
