import { useCallback, useRef } from 'react'
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { cn } from '@/lib/utils'
import type { XmlEntry } from '@/types'

interface TranslationGridProps {
  entries: XmlEntry[]
  onEntryChange: (uid: string, target: string) => void
  onEntryClick: (uid: string) => void
  selectedUids: Set<string>
  onSelectionChange: (uid: string, selected: boolean) => void
  onSelectAll: (all: boolean) => void
}

function isAutoMatched(matchType: XmlEntry['matchType']): boolean {
  return matchType === 'uid' || matchType === 'text'
}

export function TranslationGrid({
  entries,
  onEntryChange,
  onEntryClick,
  selectedUids,
  onSelectionChange,
  onSelectAll
}: TranslationGridProps): React.JSX.Element {
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

  const allSelected = entries.length > 0 && selectedUids.size === entries.length

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header row */}
      <div className="flex items-center border-b border-neutral-800 bg-neutral-900 text-xs text-neutral-500 select-none shrink-0">
        <div className="flex items-center px-3 py-2 w-10 shrink-0">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => onSelectAll(e.target.checked)}
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

      {/* Scrollable body */}
      <PanelGroup orientation="horizontal" className="flex-1 min-h-0">
        {/* Source column */}
        <Panel defaultSize={50} minSize={20}>
          <div
            ref={sourceScrollRef}
            onScroll={handleSourceScroll}
            className="h-full overflow-y-auto"
          >
            {entries.map((entry, idx) => (
              <div
                key={entry.uid}
                className={cn(
                  'flex items-start gap-2 border-b border-neutral-800',
                  isAutoMatched(entry.matchType) &&
                    'bg-yellow-950/30 border-l-2 border-l-yellow-600',
                  selectedUids.has(entry.uid) && 'bg-blue-950/30'
                )}
              >
                <div className="flex items-start pt-3 px-3 shrink-0">
                  <input
                    type="checkbox"
                    checked={selectedUids.has(entry.uid)}
                    onChange={(e) => onSelectionChange(entry.uid, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                    className="accent-blue-500 cursor-pointer mt-0.5"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onEntryClick(entry.uid)}
                  className="flex-1 py-3 pr-3 text-left cursor-pointer hover:bg-neutral-800/50 transition-colors"
                >
                  <span className="text-xs text-neutral-600 block mb-1">#{idx + 1}</span>
                  <p className="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap wrap-break-word">
                    {entry.source || <span className="text-neutral-600 italic">vazio</span>}
                  </p>
                </button>
              </div>
            ))}
          </div>
        </Panel>

        <PanelResizeHandle className="w-1 bg-neutral-800 hover:bg-neutral-600 cursor-col-resize transition-colors" />

        {/* Target column */}
        <Panel defaultSize={50} minSize={20}>
          <div
            ref={targetScrollRef}
            onScroll={handleTargetScroll}
            className="h-full overflow-y-auto"
          >
            {entries.map((entry) => (
              <div
                key={entry.uid}
                className={cn(
                  'border-b border-neutral-800',
                  isAutoMatched(entry.matchType) &&
                    'bg-yellow-950/30 border-l-2 border-l-yellow-600',
                  selectedUids.has(entry.uid) && 'bg-blue-950/30'
                )}
              >
                <textarea
                  defaultValue={entry.target}
                  onBlur={(e) => {
                    if (e.target.value !== entry.target) {
                      onEntryChange(entry.uid, e.target.value)
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  rows={3}
                  className="w-full resize-none bg-transparent px-3 py-3 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:bg-neutral-800/30"
                  placeholder="Tradução..."
                />
              </div>
            ))}
          </div>
        </Panel>
      </PanelGroup>
    </div>
  )
}
