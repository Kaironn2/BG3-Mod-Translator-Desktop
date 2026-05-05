import { Search, X } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels'
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
    row: 'border-l-2 border-l-blue-500/50 bg-blue-950/10',
    text: 'text-blue-400',
    badge: 'bg-blue-950/60 text-blue-400',
    chipActive: 'bg-blue-900/50 border-blue-500/50 text-blue-300',
    chipIdle: 'border-transparent text-blue-500/70 hover:text-blue-400 hover:border-blue-700/50',
    label: 'Dicionário',
  },
  tool: {
    row: 'border-l-2 border-l-emerald-500/50 bg-emerald-950/10',
    text: 'text-emerald-400',
    badge: 'bg-emerald-950/60 text-emerald-400',
    chipActive: 'bg-emerald-900/50 border-emerald-500/50 text-emerald-300',
    chipIdle: 'border-transparent text-emerald-500/70 hover:text-emerald-400 hover:border-emerald-700/50',
    label: 'Ferramentas',
  },
  manual: {
    row: 'border-l-2 border-l-yellow-500/50 bg-yellow-950/10',
    text: 'text-yellow-400',
    badge: 'bg-yellow-950/60 text-yellow-400',
    chipActive: 'bg-yellow-900/50 border-yellow-500/50 text-yellow-300',
    chipIdle: 'border-transparent text-yellow-500/70 hover:text-yellow-400 hover:border-yellow-700/50',
    label: 'Manual',
  },
  none: {
    row: '',
    text: 'text-neutral-600',
    badge: '',
    chipActive: '',
    chipIdle: '',
    label: '',
  },
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

  const sourceScrollRef = useRef<HTMLDivElement>(null)
  const targetScrollRef = useRef<HTMLDivElement>(null)
  const syncingRef = useRef(false)

  const handleSourceScroll = useCallback(() => {
    if (syncingRef.current) return
    syncingRef.current = true
    if (targetScrollRef.current && sourceScrollRef.current) {
      targetScrollRef.current.scrollTop = sourceScrollRef.current.scrollTop
    }
    syncingRef.current = false
  }, [])

  const handleTargetScroll = useCallback(() => {
    if (syncingRef.current) return
    syncingRef.current = true
    if (sourceScrollRef.current && targetScrollRef.current) {
      sourceScrollRef.current.scrollTop = targetScrollRef.current.scrollTop
    }
    syncingRef.current = false
  }, [])

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

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* IDE Pro search + filter bar */}
      <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-950 px-3 py-2 shrink-0">
        <div className="flex items-center gap-1.5 flex-1 min-w-0 rounded-md border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 focus-within:border-neutral-700 transition-colors">
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
                ? 'border-neutral-600 bg-neutral-800 text-neutral-200'
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
                <span
                  className={cn('inline-block w-1.5 h-1.5 rounded-full shrink-0', s.badge)}
                />
                {s.label}
                <span className="tabular-nums opacity-70">{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Side-by-side view */}
      {viewMode === 'side' ? (
        <>
          <div className="flex items-center border-b border-neutral-800 bg-neutral-900/60 text-xs text-neutral-500 select-none shrink-0">
            <div className="flex items-center px-3 py-2 w-10 shrink-0">
              <input
                type="checkbox"
                checked={allFiltered}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="accent-blue-500 cursor-pointer"
              />
            </div>
            <PanelGroup orientation="horizontal" className="flex-1">
              <Panel defaultSize={50} minSize={20}>
                <div className="px-3 py-2 font-medium">Origem</div>
              </Panel>
              <div className="w-1" />
              <Panel defaultSize={50} minSize={20}>
                <div className="px-3 py-2 font-medium">Tradução</div>
              </Panel>
            </PanelGroup>
          </div>

          <PanelGroup orientation="horizontal" className="flex-1 min-h-0">
            <Panel defaultSize={50} minSize={20}>
              <div
                ref={sourceScrollRef}
                onScroll={handleSourceScroll}
                className="h-full overflow-y-auto"
              >
                {filteredEntries.map((entry, idx) => {
                  const cat = getCategory(entry)
                  return (
                    <div
                      key={entry.uid}
                      className={cn(
                        'flex items-start gap-2 border-b border-neutral-800',
                        CAT[cat].row,
                        selectedUids.has(entry.uid) && 'bg-blue-950/20'
                      )}
                    >
                      <div className="flex items-start pt-3 px-3 shrink-0">
                        <input
                          type="checkbox"
                          checked={selectedUids.has(entry.uid)}
                          onChange={(e) => onSelectionChange(entry.uid, e.target.checked)}
                          className="accent-blue-500 cursor-pointer mt-0.5"
                        />
                      </div>
                      <div className="flex-1 py-3 pr-3">
                        <span className="text-xs text-neutral-600 block mb-1">#{idx + 1}</span>
                        <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap wrap-break-word">
                          {entry.source || <span className="text-neutral-600 italic">vazio</span>}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </Panel>

            <PanelResizeHandle className="w-1 bg-neutral-800 hover:bg-neutral-600 cursor-col-resize transition-colors" />

            <Panel defaultSize={50} minSize={20}>
              <div
                ref={targetScrollRef}
                onScroll={handleTargetScroll}
                className="h-full overflow-y-auto"
              >
                {filteredEntries.map((entry) => {
                  const cat = getCategory(entry)
                  return (
                    <div
                      key={entry.uid}
                      className={cn(
                        'border-b border-neutral-800',
                        CAT[cat].row,
                        selectedUids.has(entry.uid) && 'bg-blue-950/20'
                      )}
                    >
                      <textarea
                        defaultValue={entry.target}
                        onBlur={(e) => handleEntryBlur(entry, e.target.value)}
                        rows={3}
                        className="w-full resize-none bg-transparent px-3 py-3 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:bg-neutral-800/30"
                        placeholder="Tradução..."
                      />
                    </div>
                  )
                })}
              </div>
            </Panel>
          </PanelGroup>
        </>
      ) : (
        /* Stacked view */
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-900/60 px-3 py-2 sticky top-0 z-10 select-none">
            <input
              type="checkbox"
              checked={allFiltered}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="accent-blue-500 cursor-pointer"
            />
            <span className="text-xs text-neutral-500 font-medium">
              {filteredEntries.length} entradas
            </span>
          </div>

          {filteredEntries.map((entry, idx) => {
            const cat = getCategory(entry)
            const s = CAT[cat]
            return (
              <div
                key={entry.uid}
                className={cn(
                  'border-b border-neutral-800',
                  s.row,
                  selectedUids.has(entry.uid) && 'bg-blue-950/20'
                )}
              >
                <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
                  <input
                    type="checkbox"
                    checked={selectedUids.has(entry.uid)}
                    onChange={(e) => onSelectionChange(entry.uid, e.target.checked)}
                    className="accent-blue-500 cursor-pointer shrink-0"
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

                <div className="mx-3 border-t border-neutral-800/60" />

                <textarea
                  defaultValue={entry.target}
                  onBlur={(e) => handleEntryBlur(entry, e.target.value)}
                  rows={2}
                  className="w-full resize-none bg-transparent px-3 py-2.5 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:bg-neutral-800/20"
                  placeholder="Tradução..."
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
