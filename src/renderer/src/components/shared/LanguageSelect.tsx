import { useEffect, useState } from 'react'
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

  useEffect(() => {
    window.api.language.getAll().then(setLanguages)
  }, [])

  return (
    <ThemedSelect
      value={value}
      onChange={onChange}
      label={label}
      className={className}
      placeholder="Select language"
      searchable
      searchPlaceholder="Search language..."
      emptyLabel="No language found."
      options={languages.map((language) => ({
        value: language.code,
        label: language.name,
        badge: language.code.toUpperCase(),
        searchText: `${language.name} ${language.code}`
      }))}
    />
  )
}
