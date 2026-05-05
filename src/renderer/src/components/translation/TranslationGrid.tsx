import { BookOpen, Search, Sparkles, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import type { XmlEntry } from '@/types'

type FilterMode = 'all' | 'dictionary' | 'tool' | 'manual'

interface TranslationGridProps {
  entries: XmlEntry[]
  onEntryChange: (uid: string, target: string) => void
  onEntryManualEdit: (uid: string) => void
  selectedUids: Set<string>
  onSelectionChange: (uid: string, selected: boolean) => void
  onSelectAll: (uids: string[], selected: boolean) => void
  viewMode: 'stacked' | 'side'
}

function getCategory(entry: XmlEntry): 'dictionary' | 'tool' | 'manual' | 'none' {
  if (entry.matchType === 'uid' || entry.matchType === 'text') return 'dictionary'
  if (entry.matchType === 'manual') return 'manual'
  if (entry.target.trim()) return 'tool'
  return 'none'
}

const CAT = {
  dictionary: {
    text: 'text-blue-400',
    badge: 'bg-blue-950/60 text-blue-400',
    chipActive: 'bg-blue-900/50 border-blue-500/50 text-blue-300',
    chipIdle: 'border-transparent text-blue-500/70 hover:text-blue-400 hover:border-blue-700/50',
    label: 'Dicionário',
  },
  tool: {
    text: 'text-emerald-400',
    badge: 'bg-emerald-950/60 text-emerald-400',
    chipActive: 'bg-emerald-900/50 border-emerald-500/50 text-emerald-300',
    chipIdle:
      'border-transparent text-emerald-500/70 hover:text-emerald-400 hover:border-emerald-700/50',
    label: 'Ferramentas',
  },
  manual: {
    text: 'text-yellow-400',
    badge: 'bg-yellow-950/60 text-yellow-400',
    chipActive: 'bg-yellow-900/50 border-yellow-500/50 text-yellow-300',
    chipIdle:
      'border-transparent text-yellow-500/70 hover:text-yellow-400 hover:border-yellow-700/50',
    label: 'Manual',
  },
  none: {
    text: 'text-neutral-600',
    badge: '',
    chipActive: '',
    chipIdle: '',
    label: '',
  },
}

// Highlights XML tags and {placeholders} in source text
function renderSource(text: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  const re = /(<[^>]+>|\{[^}]+\})/g
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`t${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>)
    }
    const isTag = match[0].startsWith('<')
    parts.push(
      <span
        key={`m${match.index}`}
        className={
          isTag
            ? 'bg-purple-500/14 text-purple-300 px-1 py-px rounded-sm text-[0.92em]'
            : 'bg-amber-500/14 text-amber-400 px-1 py-px rounded-sm text-[0.92em]'
        }
      >
        {match[0]}
      </span>
    )
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    parts.push(<span key={`t${lastIndex}`}>{text.slice(lastIndex)}</span>)
  }
  return parts.length > 0 ? parts : text
}

function KbdHint({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center h-4.5 min-w-4.5 px-1 rounded bg-[#181b1f] border border-[#2a2f37] border-b-2 font-mono text-[10px] text-neutral-400">
      {children}
    </span>
  )
}

export function TranslationGrid({
  entries,
  onEntryChange,
  onEntryManualEdit,
  selectedUids,
  onSelectionChange,
  onSelectAll,
  viewMode,
}: TranslationGridProps): React.JSX.Element {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterMode>('all')
  const [focusedUid, setFocusedUid] = useState<string | null>(null)

  const counts = useMemo(
    () => ({
      dictionary: entries.filter((e) => getCategory(e) === 'dictionary').length,
      tool: entries.filter((e) => getCategory(e) === 'tool').length,
      manual: entries.filter((e) => getCategory(e) === 'manual').length,
    }),
    [entries]
  )

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (filter !== 'all' && getCategory(e) !== filter) return false
      if (search) {
        const q = search.toLowerCase()
        return e.source.toLowerCase().includes(q) || e.target.toLowerCase().includes(q)
      }
      return true
    })
  }, [entries, filter, search])

  const allFiltered =
    filteredEntries.length > 0 && filteredEntries.every((e) => selectedUids.has(e.uid))

  const handleSelectAll = (checked: boolean) => {
    onSelectAll(
      filteredEntries.map((e) => e.uid),
      checked
    )
  }

  const handleEntryBlur = (entry: XmlEntry, value: string) => {
    if (value !== entry.target) {
      onEntryChange(entry.uid, value)
      if (entry.matchType === 'none') onEntryManualEdit(entry.uid)
    }
  }

  // ── IDE Pro search + filter bar ──────────────────────────────────────────
  const searchBar = (
    <div className="flex items-center gap-2 border-b border-[#1f2329] bg-[#0c0d0f] px-3 py-2 shrink-0">
      <div className="flex items-center gap-1.5 flex-1 min-w-0 rounded-md border border-[#1f2329] bg-[#131518] px-2.5 py-1.5 focus-within:border-neutral-600 transition-colors">
        <Search size={13} className="text-neutral-500 shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar entradas..."
          className="flex-1 min-w-0 bg-transparent text-sm text-neutral-300 placeholder:text-neutral-600 focus:outline-none"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} className="shrink-0">
            <X size={13} className="text-neutral-500 hover:text-neutral-300 transition-colors" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={cn(
            'flex items-center gap-1.5 rounded border px-2 py-1 text-xs transition-colors',
            filter === 'all'
              ? 'border-[#2a2f37] bg-[#181b1f] text-neutral-200'
              : 'border-transparent text-neutral-500 hover:text-neutral-300'
          )}
        >
          Todas
          <span className="text-neutral-600 tabular-nums">{entries.length}</span>
        </button>

        {(['dictionary', 'tool', 'manual'] as const).map((cat) => {
          const s = CAT[cat]
          const count = counts[cat]
          const active = filter === cat
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setFilter(cat)}
              className={cn(
                'flex items-center gap-1.5 rounded border px-2 py-1 text-xs transition-colors',
                active ? s.chipActive : s.chipIdle
              )}
            >
              <span className={cn('inline-block w-1.5 h-1.5 rounded-full shrink-0', s.badge)} />
              {s.label}
              <span className="tabular-nums opacity-70">{count}</span>
            </button>
          )
        })}
      </div>
    </div>
  )

  // ── Side-by-side view ────────────────────────────────────────────────────
  if (viewMode === 'side') {
    return (
      <div className="flex flex-col h-full min-h-0">
        {searchBar}

        {/* Column headers — grid mirrors row layout */}
        <div
          className="grid shrink-0 border-b border-[#1f2329] bg-[#0f1114] select-none"
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

        {/* Single scroll container — one scrollbar for the whole grid */}
        <div className="flex-1 min-h-0 overflow-y-auto icosa-scroll">
          {filteredEntries.map((entry, idx) => {
            const cat = getCategory(entry)
            const isDone = entry.target.trim() !== ''
            const isFocused = focusedUid === entry.uid
            const isSelected = selectedUids.has(entry.uid)
            const isDict = cat === 'dictionary'
            const charCount = entry.source.length
            const rows = Math.max(2, Math.ceil(charCount / 70))

            return (
              <div
                key={entry.uid}
                className={cn(
                  'grid border-b border-[#1f2329] transition-colors',
                  isFocused
                    ? 'bg-[#131518] shadow-[inset_3px_0_0_#f59e0b]'
                    : 'hover:bg-[#131518]/60',
                  isSelected && !isFocused && 'bg-blue-950/10'
                )}
                style={{ gridTemplateColumns: '80px 1fr 1fr' }}
              >
                {/* Gutter — checkbox, line number, status dot */}
                <div
                  className="flex flex-col items-center gap-2 py-4 px-3 border-r border-[#1f2329] bg-[#0f1114] cursor-pointer"
                  onClick={() => setFocusedUid(isFocused ? null : entry.uid)}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => onSelectionChange(entry.uid, e.target.checked)}
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

                {/* Source — monospace text + badges */}
                <div
                  className="flex flex-col gap-2 py-4 px-4 min-w-0 cursor-pointer"
                  onClick={() => setFocusedUid(isFocused ? null : entry.uid)}
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
                        <BookOpen size={10} /> D{' '}
                        <span className="text-blue-500/70">1</span>
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-neutral-600">
                      {charCount} c
                    </span>
                  </div>
                </div>

                {/* Target — textarea + action bar when focused */}
                <div
                  className="flex flex-col gap-2 py-4 px-4 border-l border-[#1f2329] min-w-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <textarea
                    defaultValue={entry.target}
                    onFocus={() => setFocusedUid(entry.uid)}
                    onBlur={(e) => handleEntryBlur(entry, e.target.value)}
                    rows={rows}
                    placeholder="Tradução..."
                    className="flex-1 w-full resize-none bg-[#131518] border border-[#1f2329] rounded-md px-2.5 py-2 text-[13px] text-neutral-200 leading-[1.55] placeholder:text-neutral-600 placeholder:italic focus:outline-none focus:border-amber-500/60 focus:shadow-[0_0_0_3px_rgba(245,158,11,0.18)] transition-[border-color,box-shadow]"
                  />

                  {isFocused && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 h-6 px-2 rounded border-0 bg-transparent text-[11px] text-neutral-400 hover:bg-[#1c1f24] hover:text-neutral-200 cursor-pointer transition-colors"
                      >
                        <Sparkles size={11} />
                        Sugerir IA
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 h-6 px-2 rounded border-0 bg-transparent text-[11px] text-neutral-400 hover:bg-[#1c1f24] hover:text-neutral-200 cursor-pointer transition-colors"
                      >
                        <BookOpen size={11} />
                        Aplicar dicionário
                      </button>
                      <span className="ml-auto flex items-center gap-1 text-[11px] text-neutral-500">
                        <KbdHint>↵</KbdHint> próximo
                        <span className="mx-1 text-neutral-700">·</span>
                        <KbdHint>⇧↵</KbdHint> nova linha
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Stacked view ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full min-h-0">
      {searchBar}

      <div className="flex-1 min-h-0 overflow-y-auto icosa-scroll">
        <div className="flex items-center gap-2 border-b border-[#1f2329] bg-[#0f1114] px-3 py-2 sticky top-0 z-10 select-none">
          <input
            type="checkbox"
            checked={allFiltered}
            onChange={(e) => handleSelectAll(e.target.checked)}
            className="accent-amber-500 cursor-pointer"
          />
          <span className="text-xs text-neutral-500 font-medium">
            {filteredEntries.length} entradas
          </span>
        </div>

        {filteredEntries.map((entry, idx) => {
          const cat = getCategory(entry)
          const s = CAT[cat]
          const isSelected = selectedUids.has(entry.uid)
          return (
            <div
              key={entry.uid}
              className={cn(
                'border-b border-[#1f2329]',
                isSelected && 'bg-blue-950/10'
              )}
            >
              <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => onSelectionChange(entry.uid, e.target.checked)}
                  className="accent-amber-500 cursor-pointer shrink-0"
                />
                <span className="text-xs text-neutral-600">#{idx + 1}</span>
                {cat !== 'none' && (
                  <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', s.badge)}>
                    {s.label}
                  </span>
                )}
              </div>

              <p className="px-3 pb-2.5 text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap wrap-break-word">
                {entry.source || <span className="text-neutral-600 italic">vazio</span>}
              </p>

              <div className="mx-3 border-t border-[#1f2329]/60" />

              <textarea
                defaultValue={entry.target}
                onBlur={(e) => {
                  if (e.target.value !== entry.target) {
                    onEntryChange(entry.uid, e.target.value)
                    if (entry.matchType === 'none') onEntryManualEdit(entry.uid)
                  }
                }}
                rows={2}
                className="w-full resize-none bg-transparent px-3 py-2.5 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:bg-[#131518]/40"
                placeholder="Tradução..."
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
