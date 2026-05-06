import { AlertTriangle, BookOpen, Check, Search, Sparkles, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import {
  type TranslationSessionEntry,
  useTranslationSession
} from '@/context/TranslationSession'
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
  if (entry.matchType === 'uid' || entry.matchType === 'text') return 'dictionary'
  if (entry.matchType === 'manual') return 'manual'
  if (entry.target.trim()) return 'tool'
  return 'none'
}

function hasXmlTags(entry: TranslationSessionEntry): boolean {
  return /(<[^>]+>|\{[^}]+\})/.test(entry.source)
}

function KbdHint({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center h-4.5 min-w-4.5 px-1 rounded bg-[#181b1f] border border-[#2a2f37] border-b-2 font-mono text-[10px] text-neutral-400">
      {children}
    </span>
  )
}

// ── Tag pill (EN / PT-BR labels in cards) ─────────────────────────────────
function LangTag({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center h-5 px-2 rounded font-mono text-[10px] font-bold tracking-[0.06em]',
        accent
          ? 'bg-amber-500/14 text-amber-400'
          : 'bg-[#131518] border border-[#1f2329] text-neutral-400'
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

  // Maps uid → textarea DOM element so Enter can jump to the next row
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map())
  // Tracks which entries were saved via Enter to skip the subsequent onBlur save
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
    return entries.filter((e) => {
      if (filter === 'untranslated' && e.target.trim()) return false
      if (filter === 'translated' && !e.target.trim()) return false
      if (filter === 'dictionary' && getCategory(e) !== 'dictionary') return false
      if (filter === 'tags' && !hasXmlTags(e)) return false
      if (search) {
        const q = search.toLowerCase()
        return e.source.toLowerCase().includes(q) || e.target.toLowerCase().includes(q)
      }
      return true
    })
  }, [entries, filter, search])

  const allFiltered =
    filteredEntries.length > 0 && filteredEntries.every((e) => selectedUids.has(e.rowId))

  const handleSelectAll = (checked: boolean) => {
    selectEntries(
      filteredEntries.map((e) => e.rowId),
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
    // Skip if Enter already persisted this entry (blur fires right after Enter navigates away)
    if (savedByEnterRef.current.has(entry.rowId)) {
      savedByEnterRef.current.delete(entry.rowId)
      return
    }
    updateEntryTarget(entry, value)
  }

  const handleEnterKey = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    entry: TranslationSessionEntry
  ) => {
    if (e.key !== 'Enter' || e.shiftKey) return
    e.preventDefault()

    const value = e.currentTarget.value
    updateEntryTarget(entry, value)
    savedByEnterRef.current.add(entry.rowId)

    // Persist to database only if value is non-empty
    if (value.trim()) onEntrySave(entry.rowId, value)

    const nextIdx = filteredEntries.findIndex((fe) => fe.rowId === entry.rowId) + 1
    const nextEntry = filteredEntries[nextIdx]
    if (nextEntry) {
      const nextTextarea = textareaRefs.current.get(nextEntry.rowId)
      if (nextTextarea) {
        nextTextarea.focus()
        nextTextarea.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }

  // ── IDE Pro search + filter bar ──────────────────────────────────────────
  const filterItems: {
    mode: FilterMode
    label: string
    count: number
    dot?: string
  }[] = [
    {
      mode: 'untranslated',
      label: 'Nao traduzidas',
      count: counts.untranslated,
      dot: 'bg-slate-500'
    },
    { mode: 'translated', label: 'Traduzidas', count: counts.translated, dot: 'bg-amber-400' },
    { mode: 'dictionary', label: 'Com dicionario', count: counts.dictionary, dot: 'bg-blue-500' },
    { mode: 'tags', label: 'Com tags XML', count: counts.tags, dot: 'bg-amber-500' }
  ]

  const searchBar = (
    <div className="flex items-center gap-3 border-b border-[#1f2329] bg-[#0c0d0f] px-5 py-1 shrink-0">
      <div className="flex h-8 w-[292px] min-w-45 items-center gap-2 rounded-md border border-[#1f2329] bg-[#131518] px-3 focus-within:border-neutral-600 transition-colors">
        <Search size={13} className="text-neutral-500 shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar em strings..."
          className="flex-1 min-w-0 bg-transparent text-xs font-medium text-neutral-300 placeholder:text-neutral-600 focus:outline-none"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} className="shrink-0">
            <X size={13} className="text-neutral-500 hover:text-neutral-300 transition-colors" />
          </button>
        )}
        <span className="inline-flex items-center justify-center h-5 min-w-6 rounded border border-[#252a32] bg-[#0f1114] px-1 font-mono text-[10px] text-neutral-500">
          ⌘F
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={cn(
            'flex h-8 cursor-pointer items-center gap-2 rounded-md border px-3 text-xs font-semibold transition-colors focus:outline-none focus-visible:border-[#2a2f37] focus-visible:bg-[#181b1f] focus-visible:text-neutral-100',
            filter === 'all'
              ? 'border-[#2a2f37] bg-[#181b1f] text-neutral-100'
              : 'border-transparent text-neutral-400 hover:border-[#2a2f37] hover:bg-[#181b1f] hover:text-neutral-200'
          )}
        >
          Todas
          <span className="rounded-full bg-[#181b1f] px-1.5 py-0.5 text-[11px] text-neutral-500 tabular-nums">
            {entries.length}
          </span>
        </button>

        {filterItems.map((item) => {
          const active = filter === item.mode
          return (
            <button
              key={item.mode}
              type="button"
              onClick={() => setFilter(item.mode)}
              className={cn(
                'flex h-8 cursor-pointer items-center gap-2 rounded-md border px-2 text-xs font-semibold transition-colors focus:outline-none focus-visible:border-[#2a2f37] focus-visible:bg-[#181b1f] focus-visible:text-neutral-100',
                active
                  ? 'border-[#2a2f37] bg-[#181b1f] text-neutral-100'
                  : 'border-transparent text-neutral-400 hover:border-[#2a2f37] hover:bg-[#181b1f] hover:text-neutral-200'
              )}
            >
              <span className={cn('inline-block h-1.5 w-1.5 rounded-full shrink-0', item.dot)} />
              {item.label}
              <span className="rounded-full bg-[#181b1f] px-1.5 py-0.5 text-[11px] text-neutral-600 tabular-nums">
                {item.count}
              </span>
            </button>
          )
        })}
      </div>

      <div className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-neutral-400">
        <span className="font-mono text-neutral-500">⌘</span>
        Atalhos
      </div>
    </div>
  )

  // ── Side-by-side view (Direction A — IDE Pro) ────────────────────────────
  if (viewMode === 'side') {
    return (
      <div className="flex flex-col h-full min-h-0">
        {searchBar}

        {/* Column headers — pr-3 compensates for the 12px scrollbar-gutter below */}
        <div
          className="grid shrink-0 border-b border-[#1f2329] bg-[#0f1114] select-none pr-3"
          style={{ gridTemplateColumns: '80px 1fr 1fr' }}
        >
          <div className="flex items-center justify-center px-3 py-2 border-r border-[#1f2329]">
            <input
              type="checkbox"
              checked={allFiltered}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="accent-amber-500 cursor-pointer"
            />
          </div>
          <div className="px-4 py-2 font-semibold text-[10px] uppercase tracking-[0.08em] text-neutral-500">
            Origem · EN
          </div>
          <div className="px-4 py-2 font-semibold text-[10px] uppercase tracking-[0.08em] text-neutral-500 border-l border-[#1f2329]">
            Tradução · PT-BR
          </div>
        </div>

        {/* Single scroll container — scrollbar-gutter:stable always reserves 12px for the scrollbar */}
        <div className="flex-1 min-h-0 overflow-y-auto icosa-scroll [scrollbar-gutter:stable]">
          {filteredEntries.map((entry, idx) => {
            const cat = getCategory(entry)
            const isDone = entry.target.trim() !== ''
            const isSelected = selectedUids.has(entry.rowId)
            const isDict = cat === 'dictionary'
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
                {/* Gutter */}
                <div
                  className="flex flex-col items-center gap-2 py-3 px-3 border-r border-[#1f2329] bg-[#0f1114] cursor-pointer"
                  onClick={() => focusEntry(entry.rowId)}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => selectEntry(entry.rowId, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="accent-amber-500 cursor-pointer"
                  />
                  <span className="font-mono text-[11px] text-neutral-600 tabular-nums">
                    {String(idx + 1).padStart(3, '0')}
                  </span>
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full mt-auto transition-colors',
                      isDone ? 'bg-amber-500' : 'bg-neutral-700'
                    )}
                  />
                </div>

                {/* Source */}
                <div
                  className="flex flex-col gap-2 py-3 px-4 min-w-0 cursor-pointer"
                  onClick={() => focusEntry(entry.rowId)}
                >
                  <div className="font-mono text-[13px] text-neutral-200 leading-[1.6] whitespace-pre-wrap wrap-break-word">
                    {entry.source ? (
                      renderSource(entry.source)
                    ) : (
                      <span className="text-neutral-600 italic">vazio</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {isDict && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-500/12 text-blue-400">
                        <BookOpen size={10} /> D <span className="text-blue-500/70">1</span>
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-neutral-600">{charCount} c</span>
                  </div>
                </div>

                {/* Target */}
                <div
                  className="flex flex-col gap-2 py-3 px-4 border-l border-[#1f2329] min-w-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <textarea
                    ref={(el) => {
                      if (el) textareaRefs.current.set(entry.rowId, el)
                      else textareaRefs.current.delete(entry.rowId)
                    }}
                    key={`${entry.rowId}:${entry.target}`}
                    defaultValue={entry.target}
                    onBlur={(e) => handleEntryBlur(entry, e.target.value)}
                    onKeyDown={(e) => handleEnterKey(e, entry)}
                    rows={1}
                    placeholder="Tradução..."
                    className="w-full resize-none field-sizing-content bg-[#131518] border border-[#1f2329] rounded-md px-2.5 py-2 text-[13px] text-neutral-200 leading-[1.55] placeholder:text-neutral-600 placeholder:italic focus:outline-none focus:border-amber-500/60 focus:shadow-[0_0_0_3px_rgba(245,158,11,0.18)] transition-[border-color,box-shadow]"
                  />
                  <div
                    className={cn(
                      'flex items-center gap-1.5 opacity-0 pointer-events-none transition-opacity duration-150 group-focus-within:opacity-100 group-focus-within:pointer-events-auto'
                    )}
                  >
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 h-6 px-2 rounded bg-transparent text-[11px] text-neutral-400 hover:bg-[#1c1f24] hover:text-neutral-200 cursor-pointer transition-colors"
                    >
                      <Sparkles size={11} /> Sugerir IA
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 h-6 px-2 rounded bg-transparent text-[11px] text-neutral-400 hover:bg-[#1c1f24] hover:text-neutral-200 cursor-pointer transition-colors"
                    >
                      <BookOpen size={11} /> Aplicar dicionário
                    </button>
                    <span className="ml-auto flex items-center gap-1 text-[11px] text-neutral-500">
                      <KbdHint>↵</KbdHint> próximo
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

  // ── Stacked view (Direction B — Focus Stack) ─────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0">
      {searchBar}

      {/* Thin select-all bar */}
      <div className="flex items-center gap-2 border-b border-[#1f2329] bg-[#0f1114] px-7 py-2 shrink-0 select-none">
        <input
          type="checkbox"
          checked={allFiltered}
          onChange={(e) => handleSelectAll(e.target.checked)}
          className="accent-amber-500 cursor-pointer"
        />
        <span className="text-[11px] text-neutral-500 font-medium tabular-nums">
          {filteredEntries.length} entradas
        </span>
      </div>

      {/* Card list */}
      <div className="flex-1 min-h-0 overflow-y-auto icosa-scroll">
        <div className="px-7 pt-5 pb-20">
          <div className="flex flex-col gap-3.5 max-w-275 mx-auto">
            {filteredEntries.map((entry, idx) => {
              const cat = getCategory(entry)
              const isDone = entry.target.trim() !== ''
              const isSelected = selectedUids.has(entry.rowId)
              const isDict = cat === 'dictionary'
              const hasTags = hasXmlTags(entry)
              const wordCount = entry.source.split(/\s+/).filter(Boolean).length
              const charCount = entry.source.length
              const rows = Math.max(2, Math.ceil(charCount / 70))

              return (
                <div
                  key={entry.rowId}
                  className={cn(
                    'group grid overflow-hidden rounded-xl border cursor-pointer transition-all duration-120',
                    // base
                    'bg-[#0f1114] border-[#1f2329]',
                    // hover
                    'hover:border-[#2a2f37] hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(0,0,0,0.18)]',
                    // focused via textarea focus
                    'focus-within:border-amber-500 focus-within:shadow-[0_0_0_3px_rgba(245,158,11,0.25),0_8px_24px_rgba(0,0,0,0.24)]',
                    // selected tint
                    isSelected && 'border-blue-700/40 bg-blue-950/10'
                  )}
                  style={{ gridTemplateColumns: '56px 1fr' }}
                  onClick={() => focusEntry(entry.rowId)}
                >
                  {/* Side column — checkbox, vertical number, status circle */}
                  <div className="flex flex-col items-center gap-3 py-4.5 border-r border-[#1f2329] bg-[#0c0d0f]">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => selectEntry(entry.rowId, e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                      className="accent-amber-500 cursor-pointer"
                    />

                    {/* Vertical line number */}
                    <span
                      className="font-mono text-[11px] text-neutral-600 tracking-widest mt-auto"
                      style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                    >
                      #{String(idx + 1).padStart(3, '0')}
                    </span>

                    {/* Status circle */}
                    <div
                      className={cn(
                        'w-5.5 h-5.5 rounded-full border flex items-center justify-center transition-colors',
                        isDone
                          ? 'bg-amber-500 border-amber-500 text-white'
                          : 'bg-[#131518] border-[#1f2329]'
                      )}
                    >
                      {isDone ? (
                        <Check size={11} strokeWidth={2.5} />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
                      )}
                    </div>
                  </div>

                  {/* Card body */}
                  <div
                    className="flex flex-col gap-3 py-4.5 px-5.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Header row: EN tag + meta + badges */}
                    <div className="flex items-center gap-2.5">
                      <LangTag>EN</LangTag>
                      <span className="font-mono text-[10px] text-neutral-600 tracking-[0.02em]">
                        {charCount} caracteres · {wordCount} palavras
                      </span>
                      <span className="flex-1" />
                      {isDict && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/12 text-blue-400">
                          <BookOpen size={11} />
                          {entry.matchType === 'uid' ? '1 termo (uid)' : '1 termo'}
                        </span>
                      )}
                      {hasTags && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/12 text-amber-400">
                          <AlertTriangle size={11} /> contém tags
                        </span>
                      )}
                    </div>

                    {/* Source text */}
                    <div className="font-mono text-[14px] leading-[1.65] text-neutral-200 whitespace-pre-wrap wrap-break-word">
                      {entry.source ? (
                        renderSource(entry.source)
                      ) : (
                        <span className="text-neutral-600 italic">vazio</span>
                      )}
                    </div>

                    {/* Dict strip — shown when focused and is a dict match */}
                    {isDict && (
                      <div className="hidden items-center gap-2 px-3 py-2 bg-[#0c0d0f] border border-dashed border-[#2a2f37] rounded-lg flex-wrap group-focus-within:flex">
                        <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-[0.08em]">
                          Dicionário sugere:
                        </span>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-[#0f1114] border border-[#1f2329] rounded-full text-[12px] cursor-pointer hover:border-amber-500 hover:bg-amber-500/10 transition-colors"
                          onClick={() => {
                            onEntryChange(entry.rowId, entry.target)
                          }}
                        >
                          <span className="font-mono text-neutral-400">
                            {entry.source.slice(0, 24)}
                            {entry.source.length > 24 ? '…' : ''}
                          </span>
                          <span className="text-neutral-600">→</span>
                          <span className="text-neutral-200 font-medium">
                            {entry.target || '—'}
                          </span>
                        </button>
                      </div>
                    )}

                    {/* PT-BR tag row + action bar */}
                    <div className="flex items-center gap-2.5 pt-1 border-t border-dashed border-[#1f2329] mt-1">
                      <LangTag accent>PT-BR</LangTag>
                      <div
                        className={cn(
                          'flex-1 flex items-center gap-1.5 opacity-0 pointer-events-none transition-opacity duration-150 group-focus-within:opacity-100 group-focus-within:pointer-events-auto'
                        )}
                      >
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 h-6 px-2 rounded bg-transparent text-[11px] text-neutral-400 hover:bg-[#1c1f24] hover:text-neutral-200 cursor-pointer transition-colors"
                        >
                          <Sparkles size={11} /> Sugerir IA
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 h-6 px-2 rounded bg-transparent text-[11px] text-neutral-400 hover:bg-[#1c1f24] hover:text-neutral-200 cursor-pointer transition-colors"
                        >
                          <Check size={11} /> Marcar como traduzida
                        </button>
                        <span className="flex-1" />
                        <span className="flex items-center gap-1 text-[11px] text-neutral-500">
                          <KbdHint>↵</KbdHint> próximo
                          <span className="mx-0.5 text-neutral-700">·</span>
                          <KbdHint>⇧↵</KbdHint> nova linha
                        </span>
                      </div>
                    </div>

                    {/* Translation textarea */}
                    <textarea
                      ref={(el) => {
                        if (el) textareaRefs.current.set(entry.rowId, el)
                        else textareaRefs.current.delete(entry.rowId)
                      }}
                      key={`${entry.rowId}:${entry.target}`}
                      defaultValue={entry.target}
                      onBlur={(e) => handleEntryBlur(entry, e.target.value)}
                      onKeyDown={(e) => handleEnterKey(e, entry)}
                      rows={rows}
                      placeholder={isDone ? '' : 'Comece a digitar a tradução...'}
                      className="w-full resize-none bg-[#0c0d0f] border border-[#1f2329] rounded-lg px-3.5 py-3 text-[13px] text-neutral-200 leading-[1.6] placeholder:text-neutral-600 placeholder:italic focus:outline-none focus:border-amber-500 focus:shadow-[0_0_0_3px_rgba(245,158,11,0.25)] min-h-11 transition-[border-color,box-shadow]"
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
