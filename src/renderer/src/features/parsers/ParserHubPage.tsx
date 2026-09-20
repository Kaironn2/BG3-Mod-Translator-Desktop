import { parsersByKind, searchParsers } from '@shared/parsers/catalog'
import type { ParserManifest } from '@shared/parsers/types'
import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { ParserCard } from './ParserCard'

export function ParserHubPage(): React.JSX.Element {
  const { t } = useAppTranslation(['translate', 'toasts'])
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => searchParsers(query), [query])
  const filteredIds = useMemo(() => new Set(filtered.map((parser) => parser.id)), [filtered])
  const generic = parsersByKind('generic').filter((parser) => filteredIds.has(parser.id))
  const games = parsersByKind('game').filter((parser) => filteredIds.has(parser.id))

  const openParser = (parser: ParserManifest) => {
    if (parser.status === 'comingSoon') {
      toast.info(t('translate.comingSoon', { ns: 'toasts', name: parser.name }))
      return
    }
    navigate(`/translate/${parser.id}`)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-[#1f2329] bg-[#131518] px-6 py-4">
        <h1 className="m-0 text-[15px] font-semibold tracking-tight text-neutral-200">
          {t('hub.title', { ns: 'translate' })}
        </h1>
        <p className="mt-1 mb-3 text-xs text-neutral-500">
          {t('hub.subtitle', { ns: 'translate' })}
        </p>
        <label className="flex h-8 w-full max-w-md items-center gap-2 rounded-md border border-[#1f2329] bg-[#0f1114] px-3">
          <Search size={13} className="text-neutral-600" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('hub.searchPlaceholder', { ns: 'translate' })}
            className="h-full w-full bg-transparent text-xs text-neutral-200 outline-none placeholder:text-neutral-600"
          />
        </label>
      </div>

      <div className="icosa-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5 [scrollbar-gutter:stable]">
        <div className="mx-auto flex max-w-5xl flex-col gap-7">
          {filtered.length === 0 ? (
            <div className="flex h-24 items-center text-sm text-neutral-500">
              {t('hub.searchEmpty', { ns: 'translate' })}
            </div>
          ) : (
            <>
              {generic.length > 0 ? (
                <ParserSection title={t('hub.generic', { ns: 'translate' })}>
                  {generic.map((parser) => (
                    <ParserCard key={parser.id} parser={parser} onSelect={openParser} />
                  ))}
                </ParserSection>
              ) : null}
              {games.length > 0 ? (
                <ParserSection title={t('hub.games', { ns: 'translate' })}>
                  {games.map((parser) => (
                    <ParserCard key={parser.id} parser={parser} onSelect={openParser} />
                  ))}
                </ParserSection>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ParserSection({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section>
      <h2 className="mb-3 text-[11px] font-semibold tracking-[0.08em] text-neutral-500 uppercase">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
    </section>
  )
}
