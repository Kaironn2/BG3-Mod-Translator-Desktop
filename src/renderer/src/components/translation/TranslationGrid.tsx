import { AlertTriangle, BookOpen, Check, Search, X } from 'lucide-react'
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from 'react'
import {
  type TranslationSessionEntry,
  useTranslationSession
} from '@/context/TranslationSession'
import { HighlightedTextarea } from '@/components/shared/HighlightedTextarea'
import { cn } from '@/lib/utils'
import { renderSource } from '@/utils/renderSource'

type TranslationCategory = 'dictionary' | 'tool' | 'manual' | 'none'
type FilterMode = 'all' | 'untranslated' | 'translated' | 'dictionary' | 'tags'

interface TranslationGridProps {
  entries: TranslationSessionEntry[]
  onEntryChange: (rowId: string, target: string) => void
  onEntryManualEdit: (rowId: string) => void
  onEntrySave: (rowId: string, target: string) => void
  viewMode: 'stacked' | 'side'
}

function getCategory(entry: TranslationSessionEntry): TranslationCategory {
  if (entry.matchType === 'mod-text' || entry.matchType === 'text') return 'dictionary'
  if (entry.matchType === 'manual') return 'manual'
  if (entry.target.trim()) return 'tool'
  return 'none'
}

function hasXmlTags(entry: TranslationSessionEntry): boolean {
  return /(<[^>]+>|\{[^}]+\})/.test(entry.source)
}

function KbdHint({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-4.5 min-w-4.5 items-center justify-center rounded border border-[#2a2f37] border-b-2 bg-[#181b1f] px-1 font-mono text-[10px] text-neutral-400">
      {children}
    </span>
  )
}

function LangTag({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded px-2 font-mono text-[10px] font-bold tracking-[0.06em]',
        accent
          ? 'bg-amber-500/14 text-amber-400'
          : 'border border-[#1f2329] bg-[#131518] text-neutral-400'
      )}
    >
      {children}
    </span>
  )
}

export function TranslationGrid({
  entries,
  onEntryChange,
  onEntryManualEdit,
  onEntrySave,
  viewMode
}: TranslationGridProps): React.JSX.Element {
  const { selectedUids, selectEntry, selectEntries } = useTranslationSession()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterMode>('all')
  const deferredSearch = useDeferredValue(search)
  const deferredFilter = useDeferredValue(filter)
  const [isPending, startFilterTransition] = useTransition()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map())
  const savedByEnterRef = useRef<Set<string>>(new Set())

  const counts = useMemo(() => {
    let translated = 0
    let untranslated = 0
    let dictionary = 0
    let tags = 0

    for (const entry of entries) {
      if (entry.target.trim()) translated += 1
      else untranslated += 1
      if (getCategory(entry) === 'dictionary') dictionary += 1
      if (hasXmlTags(entry)) tags += 1
    }

    return { translated, untranslated, dictionary, tags }
  }, [entries])

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (deferredFilter === 'untranslated' && entry.target.trim()) return false
      if (deferredFilter === 'translated' && !entry.target.trim()) return false
      if (deferredFilter === 'dictionary' && getCategory(entry) !== 'dictionary') return false
      if (deferredFilter === 'tags' && !hasXmlTags(entry)) return false
      if (deferredSearch) {
        const query = deferredSearch.toLowerCase()
        return (
          entry.source.toLowerCase().includes(query) || entry.target.toLowerCase().includes(query)
        )
      }
      return true
    })
  }, [deferredFilter, deferredSearch, entries])

  const selectedStats = useMemo(() => {
    let selectedStrings = 0
    let selectedCharacters = 0

    for (const entry of entries) {
      if (!selectedUids.has(entry.rowId)) continue
      selectedStrings += 1
      selectedCharacters += entry.source.length
    }

    return { selectedStrings, selectedCharacters }
  }, [entries, selectedUids])

  const allFiltered =
    filteredEntries.length > 0 && filteredEntries.every((entry) => selectedUids.has(entry.rowId))

  useEffect(() => {
    const handleFindShortcut = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) return
      if (event.key.toLowerCase() !== 'f') return
      event.preventDefault()
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    }

    window.addEventListener('keydown', handleFindShortcut)
    return () => window.removeEventListener('keydown', handleFindShortcut)
  }, [])

  const handleSelectAll = (checked: boolean) => {
    selectEntries(
      filteredEntries.map((entry) => entry.rowId),
      checked
    )
  }

  const focusEntry = (rowId: string) => {
    textareaRefs.current.get(rowId)?.focus()
  }

  const updateEntryTarget = (entry: TranslationSessionEntry, value: string) => {
    if (value !== entry.target) {
      onEntryChange(entry.rowId, value)
      if (entry.matchType === 'none') onEntryManualEdit(entry.rowId)
    }
  }

  const handleEntryBlur = (entry: TranslationSessionEntry, value: string) => {
    if (savedByEnterRef.current.has(entry.rowId)) {
      savedByEnterRef.current.delete(entry.rowId)
      return
    }
    updateEntryTarget(entry, value)
  }

  const handleEnterKey = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    entry: TranslationSessionEntry
  ) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()

    const value = event.currentTarget.value
    updateEntryTarget(entry, value)
    savedByEnterRef.current.add(entry.rowId)

    if (value.trim()) onEntrySave(entry.rowId, value)

    const nextIndex = filteredEntries.findIndex((item) => item.rowId === entry.rowId) + 1
    const nextEntry = filteredEntries[nextIndex]
    if (!nextEntry) return

    const nextTextarea = textareaRefs.current.get(nextEntry.rowId)
    if (!nextTextarea) return
    nextTextarea.focus()
    nextTextarea.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

  const filterItems: Array<{
    mode: FilterMode
    label: string
    count: number
    dot?: string
  }> = [
    {
      mode: 'untranslated',
      label: 'Nao traduzidas',
      count: counts.untranslated,
      dot: 'bg-slate-500'
    },
    { mode: 'translated', label: 'Traduzidas', count: counts.translated, dot: 'bg-amber-400' },
    { mode: 'dictionary', label: 'Com dicionario', count: counts.dictionary, dot: 'bg-blue-500' },
    { mode: 'tags', label: 'Com tags XML', count: counts.tags, dot: 'bg-purple-400' }
  ]

  const searchBar = (
    <div className="flex shrink-0 items-center gap-3 border-b border-[#1f2329] bg-[#0c0d0f] px-5 py-1">
      <div className="flex h-8 w-[292px] min-w-45 items-center gap-2 rounded-md border border-[#1f2329] bg-[#131518] px-3 transition-colors focus-within:border-neutral-600">
        <Search size={13} className="shrink-0 text-neutral-500" />
        <input
          ref={searchInputRef}
          value={search}
          onChange={(event) => {
            const value = event.target.value
            startTransition(() => setSearch(value))
          }}
          placeholder="Buscar em strings..."
          className="min-w-0 flex-1 bg-transparent text-xs font-medium text-neutral-300 placeholder:text-neutral-600 focus:outline-none"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="shrink-0 cursor-pointer"
          >
            <X size={13} className="text-neutral-500 transition-colors hover:text-neutral-300" />
          </button>
        )}
        <span className="inline-flex h-5 min-w-6 items-center justify-center rounded border border-[#252a32] bg-[#0f1114] px-1 font-mono text-[10px] text-neutral-500">
          Ctrl F
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={() => startFilterTransition(() => setFilter('all'))}
          className={cn(
            'flex h-8 cursor-pointer items-center gap-2 rounded-md border px-3 text-xs font-semibold transition-colors focus:outline-none focus-visible:border-[#2a2f37] focus-visible:bg-[#181b1f] focus-visible:text-neutral-100',
            filter === 'all'
              ? 'border-[#2a2f37] bg-[#181b1f] text-neutral-100'
              : 'border-transparent text-neutral-400 hover:border-[#2a2f37] hover:bg-[#181b1f] hover:text-neutral-200'
          )}
        >
          Todas
          <span className="rounded-full bg-[#181b1f] px-1.5 py-0.5 text-[11px] tabular-nums text-neutral-500">
            {entries.length}
          </span>
        </button>

        {filterItems.map((item) => {
          const active = filter === item.mode
          return (
            <button
              key={item.mode}
              type="button"
              onClick={() => startFilterTransition(() => setFilter(item.mode))}
              className={cn(
                'flex h-8 cursor-pointer items-center gap-2 rounded-md border px-2 text-xs font-semibold transition-colors focus:outline-none focus-visible:border-[#2a2f37] focus-visible:bg-[#181b1f] focus-visible:text-neutral-100',
                active
                  ? 'border-[#2a2f37] bg-[#181b1f] text-neutral-100'
                  : 'border-transparent text-neutral-400 hover:border-[#2a2f37] hover:bg-[#181b1f] hover:text-neutral-200'
              )}
            >
              <span className={cn('inline-block h-1.5 w-1.5 shrink-0 rounded-full', item.dot)} />
              {item.label}
              <span className="rounded-full bg-[#181b1f] px-1.5 py-0.5 text-[11px] tabular-nums text-neutral-600">
                {item.count}
              </span>
            </button>
          )
        })}
      </div>

      <div className="ml-auto flex items-center gap-3 text-xs font-semibold text-neutral-400">
        {isPending && (
          <span className="rounded-full border border-[#252a32] bg-[#181b1f] px-2 py-0.5 text-[10px] font-mono text-amber-400">
            atualizando...
          </span>
        )}
        <span className="font-mono tabular-nums text-neutral-500">
          {selectedStats.selectedStrings} strings • {selectedStats.selectedCharacters} characters
        </span>
      </div>
    </div>
  )

  if (viewMode === 'side') {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {searchBar}

        <div
          className="grid shrink-0 select-none border-b border-[#1f2329] bg-[#0f1114] pr-3"
          style={{ gridTemplateColumns: '80px 1fr 1fr' }}
        >
          <div className="flex items-center justify-center border-r border-[#1f2329] px-3 py-2">
            <input
              type="checkbox"
              checked={allFiltered}
              onChange={(event) => handleSelectAll(event.target.checked)}
              className="cursor-pointer accent-amber-500"
            />
          </div>
          <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
            Origem · EN
          </div>
          <div className="border-l border-[#1f2329] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
            Traducao · PT-BR
          </div>
        </div>

        <div className="icosa-scroll flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable]">
          {filteredEntries.map((entry, index) => {
            const category = getCategory(entry)
            const isDone = entry.target.trim() !== ''
            const isSelected = selectedUids.has(entry.rowId)
            const isDictionary = category === 'dictionary'
            const charCount = entry.source.length

            return (
              <div
                key={entry.rowId}
                className={cn(
                  'group grid border-b border-[#1f2329] transition-colors hover:bg-[#131518]/60 focus-within:bg-[#131518] focus-within:shadow-[inset_3px_0_0_#f59e0b]',
                  isSelected && 'bg-blue-950/10'
                )}
                style={{ gridTemplateColumns: '80px 1fr 1fr' }}
              >
                <div
                  className="flex cursor-pointer flex-col items-center gap-2 border-r border-[#1f2329] bg-[#0f1114] px-3 py-3"
                  onClick={() => focusEntry(entry.rowId)}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(event) => selectEntry(entry.rowId, event.target.checked)}
                    onClick={(event) => event.stopPropagation()}
                    className="cursor-pointer accent-amber-500"
                  />
                  <span className="font-mono text-[11px] tabular-nums text-neutral-600">
                    {String(index + 1).padStart(3, '0')}
                  </span>
                  <span
                    className={cn(
                      'mt-auto h-1.5 w-1.5 rounded-full transition-colors',
                      isDone ? 'bg-amber-500' : 'bg-neutral-700'
                    )}
                  />
                </div>

                <div
                  className="flex min-w-0 cursor-pointer flex-col gap-2 px-4 py-3"
                  onClick={() => focusEntry(entry.rowId)}
                >
                  <div className="font-mono text-[13px] leading-[1.6] text-neutral-200 whitespace-pre-wrap wrap-break-word">
                    {entry.source ? renderSource(entry.source) : (
                      <span className="italic text-neutral-600">vazio</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {isDictionary && (
                      <span className="inline-flex items-center gap-1 rounded bg-blue-500/12 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-400">
                        <BookOpen size={10} /> D <span className="text-blue-500/70">1</span>
                      </span>
                    )}
                    <span className="font-mono text-[10px] text-neutral-600">
                      {charCount} characters
                    </span>
                  </div>
                </div>

                <div
                  className="flex min-w-0 flex-col gap-2 border-l border-[#1f2329] px-4 py-3"
                  onClick={(event) => event.stopPropagation()}
                >
                  <HighlightedTextarea
                    ref={(element) => {
                      if (element) textareaRefs.current.set(entry.rowId, element)
                      else textareaRefs.current.delete(entry.rowId)
                    }}
                    value={entry.target}
                    onBlur={(event) => handleEntryBlur(entry, event.target.value)}
                    onChange={() => {}}
                    onKeyDown={(event) => handleEnterKey(event, entry)}
                    rows={1}
                    placeholder="Traducao..."
                    containerClassName="rounded-md"
                    className="field-sizing-content"
                  />
                  <div
                    className={cn(
                      'pointer-events-none flex items-center gap-1.5 opacity-0 transition-opacity duration-150 group-focus-within:pointer-events-auto group-focus-within:opacity-100'
                    )}
                  >
                    {/* <button
                      type="button"
                      className="inline-flex h-6 cursor-pointer items-center gap-1 rounded bg-transparent px-2 text-[11px] text-neutral-400 transition-colors hover:bg-[#1c1f24] hover:text-neutral-200"
                    >
                      <Sparkles size={11} /> Sugerir IA
                    </button> */}
                    <button
                      type="button"
                      className="inline-flex h-6 cursor-pointer items-center gap-1 rounded bg-transparent px-2 text-[11px] text-neutral-400 transition-colors hover:bg-[#1c1f24] hover:text-neutral-200"
                    >
                      <BookOpen size={11} /> Aplicar dicionario
                    </button>
                    <span className="ml-auto flex items-center gap-1 text-[11px] text-neutral-500">
                      <KbdHint>↵</KbdHint> proximo
                      <span className="mx-1 text-neutral-700">·</span>
                      <KbdHint>⇧↵</KbdHint> nova linha
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {searchBar}

      <div className="flex shrink-0 items-center gap-2 border-b border-[#1f2329] bg-[#0f1114] px-7 py-2 select-none">
        <input
          type="checkbox"
          checked={allFiltered}
          onChange={(event) => handleSelectAll(event.target.checked)}
          className="cursor-pointer accent-amber-500"
        />
        <span className="text-[11px] font-medium tabular-nums text-neutral-500">
          {filteredEntries.length} entradas
        </span>
      </div>

      <div className="icosa-scroll flex-1 min-h-0 overflow-y-auto">
        <div className="px-7 pb-20 pt-5">
          <div className="mx-auto flex max-w-275 flex-col gap-3.5">
            {filteredEntries.map((entry, index) => {
              const category = getCategory(entry)
              const isDone = entry.target.trim() !== ''
              const isSelected = selectedUids.has(entry.rowId)
              const isDictionary = category === 'dictionary'
              const hasTags = hasXmlTags(entry)
              const wordCount = entry.source.split(/\s+/).filter(Boolean).length
              const charCount = entry.source.length
              const rows = Math.max(2, Math.ceil(charCount / 70))

              return (
                <div
                  key={entry.rowId}
                  className={cn(
                    'group grid cursor-pointer overflow-hidden rounded-xl border transition-all duration-120',
                    'border-[#1f2329] bg-[#0f1114]',
                    'hover:-translate-y-px hover:border-[#2a2f37] hover:shadow-[0_4px_16px_rgba(0,0,0,0.18)]',
                    'focus-within:border-amber-500 focus-within:shadow-[0_0_0_3px_rgba(245,158,11,0.25),0_8px_24px_rgba(0,0,0,0.24)]',
                    isSelected && 'border-blue-700/40 bg-blue-950/10'
                  )}
                  style={{ gridTemplateColumns: '56px 1fr' }}
                  onClick={() => focusEntry(entry.rowId)}
                >
                  <div className="flex flex-col items-center gap-3 border-r border-[#1f2329] bg-[#0c0d0f] py-4.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(event) => selectEntry(entry.rowId, event.target.checked)}
                      onClick={(event) => event.stopPropagation()}
                      className="cursor-pointer accent-amber-500"
                    />

                    <span
                      className="mt-auto font-mono text-[11px] tracking-widest text-neutral-600"
                      style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                    >
                      #{String(index + 1).padStart(3, '0')}
                    </span>

                    <div
                      className={cn(
                        'flex h-5.5 w-5.5 items-center justify-center rounded-full border transition-colors',
                        isDone
                          ? 'border-amber-500 bg-amber-500 text-white'
                          : 'border-[#1f2329] bg-[#131518]'
                      )}
                    >
                      {isDone ? (
                        <Check size={11} strokeWidth={2.5} />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-neutral-600" />
                      )}
                    </div>
                  </div>

                  <div
                    className="flex flex-col gap-3 px-5.5 py-4.5"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex items-center gap-2.5">
                      <LangTag>EN</LangTag>
                      <span className="font-mono text-[10px] tracking-[0.02em] text-neutral-600">
                        {charCount} characters · {wordCount} palavras
                      </span>
                      <span className="flex-1" />
                      {isDictionary && (
                        <span className="inline-flex items-center gap-1 rounded bg-blue-500/12 px-2 py-0.5 text-[11px] font-medium text-blue-400">
                          <BookOpen size={11} />
                          {entry.matchType === 'mod-text' ? '1 termo (mod)' : '1 termo'}
                        </span>
                      )}
                      {hasTags && (
                        <span className="inline-flex items-center gap-1 rounded bg-purple-500/14 px-2 py-0.5 text-[11px] font-medium text-purple-300">
                          <AlertTriangle size={11} /> contem tags
                        </span>
                      )}
                    </div>

                    <div className="font-mono text-[14px] leading-[1.65] text-neutral-200 whitespace-pre-wrap wrap-break-word">
                      {entry.source ? renderSource(entry.source) : (
                        <span className="italic text-neutral-600">vazio</span>
                      )}
                    </div>

                    {isDictionary && (
                      <div className="hidden flex-wrap items-center gap-2 rounded-lg border border-dashed border-[#2a2f37] bg-[#0c0d0f] px-3 py-2 group-focus-within:flex">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
                          Dicionario sugere:
                        </span>
                        <button
                          type="button"
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[#1f2329] bg-[#0f1114] px-2.5 py-0.5 text-[12px] transition-colors hover:border-amber-500 hover:bg-amber-500/10"
                          onClick={() => {
                            onEntryChange(entry.rowId, entry.target)
                          }}
                        >
                          <span className="font-mono text-neutral-400">
                            {entry.source.slice(0, 24)}
                            {entry.source.length > 24 ? '…' : ''}
                          </span>
                          <span className="text-neutral-600">→</span>
                          <span className="font-medium text-neutral-200">{entry.target || '—'}</span>
                        </button>
                      </div>
                    )}

                    <div className="mt-1 flex items-center gap-2.5 border-t border-dashed border-[#1f2329] pt-1">
                      <LangTag accent>PT-BR</LangTag>
                      <div
                        className={cn(
                          'pointer-events-none flex flex-1 items-center gap-1.5 opacity-0 transition-opacity duration-150 group-focus-within:pointer-events-auto group-focus-within:opacity-100'
                        )}
                      >
                        {/* <button
                          type="button"
                          className="inline-flex h-6 cursor-pointer items-center gap-1 rounded bg-transparent px-2 text-[11px] text-neutral-400 transition-colors hover:bg-[#1c1f24] hover:text-neutral-200"
                        >
                          <Sparkles size={11} /> Sugerir IA
                        </button> */}
                        <button
                          type="button"
                          className="inline-flex h-6 cursor-pointer items-center gap-1 rounded bg-transparent px-2 text-[11px] text-neutral-400 transition-colors hover:bg-[#1c1f24] hover:text-neutral-200"
                        >
                          <Check size={11} /> Marcar como traduzida
                        </button>
                        <span className="flex-1" />
                        <span className="flex items-center gap-1 text-[11px] text-neutral-500">
                          <KbdHint>↵</KbdHint> proximo
                          <span className="mx-0.5 text-neutral-700">·</span>
                          <KbdHint>⇧↵</KbdHint> nova linha
                        </span>
                      </div>
                    </div>

                    <HighlightedTextarea
                      ref={(element) => {
                        if (element) textareaRefs.current.set(entry.rowId, element)
                        else textareaRefs.current.delete(entry.rowId)
                      }}
                      value={entry.target}
                      onBlur={(event) => handleEntryBlur(entry, event.target.value)}
                      onChange={() => {}}
                      onKeyDown={(event) => handleEnterKey(event, entry)}
                      rows={rows}
                      placeholder={isDone ? '' : 'Comece a digitar a traducao...'}
                      containerClassName="min-h-11 rounded-lg border-[#1f2329] bg-[#0c0d0f] focus-within:border-amber-500 focus-within:shadow-[0_0_0_3px_rgba(245,158,11,0.25)]"
                      overlayClassName="px-3.5 py-3 text-[13px] leading-[1.6]"
                      className="min-h-11 px-3.5 py-3 text-[13px] leading-[1.6]"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
