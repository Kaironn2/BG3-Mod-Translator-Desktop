import { useEffect, useMemo, useState } from 'react'
import { ThemedSelect } from '@/components/shared/ThemedSelect'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { languagesToSelectOptions } from '@/lib/languageOptions'
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
  const options = useMemo(
    () => languagesToSelectOptions(languages, t('badges.official'), (code) => t(`languages.${code}`)),
    [languages, t]
  )

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
      options={options}
    />
  )
}
