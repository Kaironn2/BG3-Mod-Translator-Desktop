import { Check, ChevronDown, Search } from 'lucide-react'
import { useRef, useState } from 'react'
import { useClickOutside } from '@/hooks/useClickOutside'
import { cn } from '@/lib/utils'
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
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const selected = languages.find((language) => language.code === value)
  const filtered = languages.filter(
    (language) =>
      language.name.toLowerCase().includes(query.toLowerCase()) ||
      language.code.toLowerCase().includes(query.toLowerCase())
  )

  useClickOutside(
    ref,
    () => {
      setOpen(false)
      setQuery('')
    },
    open
  )

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex items-center gap-2.5 w-full h-9.5 px-3 rounded-md border text-sm cursor-pointer transition-all text-left',
          open
            ? 'border-amber-500 bg-[#0f1114] shadow-[0_0_0_3px_rgba(245,158,11,0.15)]'
            : 'bg-[#0f1114] border-[#1f2329] hover:border-neutral-600',
          accent ? 'text-amber-400' : 'text-neutral-200'
        )}
      >
        <span className="flex-1 font-medium truncate">{selected?.name ?? 'Selecionar'}</span>
        <span
          className={cn(
            'font-mono text-[10px] px-1.5 py-0.5 rounded bg-neutral-900 border border-[#1f2329] shrink-0',
            accent ? 'text-amber-400' : 'text-neutral-500'
          )}
        >
          {(selected?.code ?? '-').toUpperCase()}
        </span>
        <span className={cn('shrink-0', accent ? 'text-amber-500' : 'text-neutral-500')}>
          <ChevronDown />
        </span>
      </button>

      {open && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-[#131518] border border-neutral-600 rounded-lg shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#1f2329] text-neutral-500">
            <Search />
            <input
              className="flex-1 bg-transparent border-0 outline-none text-neutral-200 text-xs placeholder:text-neutral-600"
              placeholder="Buscar idioma..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.map((language) => (
              <button
                key={language.code}
                type="button"
                onClick={() => {
                  onChange(language.code)
                  setOpen(false)
                  setQuery('')
                }}
                className={cn(
                  'flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-xs cursor-pointer transition-all text-left',
                  language.code === value
                    ? 'bg-amber-400/10 text-amber-400'
                    : 'text-neutral-300 hover:bg-neutral-800'
                )}
              >
                <span className="flex-1">{language.name}</span>
                <span className="font-mono text-[10px] text-neutral-500">
                  {language.code.toUpperCase()}
                </span>
                {language.code === value && <Check size={12} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
