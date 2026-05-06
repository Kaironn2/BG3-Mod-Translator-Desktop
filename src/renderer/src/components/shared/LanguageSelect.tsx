import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
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
    <div className={cn('flex flex-col gap-1', className)}>
      {label && <label className="text-xs text-neutral-400">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 focus:border-neutral-500 focus:outline-none"
      >
        <option value="">Select language</option>
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.name}
          </option>
        ))}
      </select>
    </div>
  )
}
