import { useVirtualizer } from '@tanstack/react-virtual'
import { AlertTriangle, BookOpen, Check, Copy, RefreshCw, Search, X } from 'lucide-react'
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from 'react'
import { toast } from 'sonner'
import { HighlightedTextarea } from '@/components/shared/HighlightedTextarea'
import { AITranslateModal } from '@/components/translation/AITranslateModal'
import {
  type FilterSpec,
  materializeSelectedEntries,
  type TranslationSessionEntry,
  useTranslationSession
} from '@/context/TranslationSession'
import { getProviderMeta } from '@/features/settings/aiProviders'
import { useAISettings } from '@/hooks/useAISettings'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { useAppTranslation } from '@/i18n/useAppTranslation'
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

type SourceFileTab = 'all' | 'xml' | 'loca'

function getCategory(entry: TranslationSessionEntry): TranslationCategory {
  if (entry.matchType === 'mod-text' || entry.matchType === 'text') return 'dictionary'
  if (entry.matchType === 'manual') return 'manual'
  if (entry.target.trim()) return 'tool'
  return 'none'
}

function hasXmlTags(entry: TranslationSessionEntry): boolean {
  return /(<[^>]+>|\{[^}]+\})/.test(entry.source)
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
  const { t } = useAppTranslation(['translate', 'common', 'toasts', 'ai'])
  const session = useTranslationSession()
  const {
    selection,
    isSelected,
    selectAllMatching,
    toggleEntry,
    clearSelection,
    sourceLang,
    targetLang
  } = session
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterMode>('all')
  const [sourceTab, setSourceTab] = useState<SourceFileTab>('all')
  const deferredSearch = useDeferredValue(search)
  const deferredFilter = useDeferredValue(filter)
  const deferredSourceTab = useDeferredValue(sourceTab)
  const [isPending, startFilterTransition] = useTransition()
  const [pageSize, setPageSize] = useState<100 | 250 | 500 | 1000>(250)
  const [currentPage, setCurrentPage] = useState(1)
  const [stickyRowIds, setStickyRowIds] = useState<Set<string>>(() => new Set())
  // Row the per-line "Translate with AI" modal is open for (null = closed).
  const [aiEntry, setAiEntry] = useState<TranslationSessionEntry | null>(null)
  const { provider: aiProvider } = useAISettings()
  const aiMeta = getProviderMeta(aiProvider)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map())
  const savedByEnterRef = useRef<Set<string>>(new Set())
  const sideParentRef = useRef<HTMLDivElement>(null)
  const stackedParentRef = useRef<HTMLDivElement>(null)

  const hasLocaFiles = entries.some((entry) => entry.sourceFileType === 'loca')
  const hasXmlFiles = entries.some(
    (entry) => !entry.sourceFileType || entry.sourceFileType === 'xml'
  )

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

  const tabCounts = useMemo(() => {
    let xml = 0
    let loca = 0
    for (const entry of entries) {
      if (entry.sourceFileType === 'loca') loca += 1
      else xml += 1
    }
    return { xml, loca }
  }, [entries])

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (stickyRowIds.has(entry.rowId)) return true
      if (deferredFilter === 'untranslated' && entry.target.trim()) return false
      if (deferredFilter === 'translated' && !entry.target.trim()) return false
      if (deferredFilter === 'dictionary' && getCategory(entry) !== 'dictionary') return false
      if (deferredFilter === 'tags' && !hasXmlTags(entry)) return false
      if (deferredSourceTab === 'loca' && entry.sourceFileType !== 'loca') return false
      if (deferredSourceTab === 'xml' && entry.sourceFileType === 'loca') return false
      if (deferredSearch) {
        const query = deferredSearch.toLowerCase()
        return (
          entry.source.toLowerCase().includes(query) || entry.target.toLowerCase().includes(query)
        )
      }
      return true
    })
  }, [deferredFilter, deferredSearch, deferredSourceTab, entries, stickyRowIds])

  useEffect(() => {
    setCurrentPage(1)
  }, [deferredFilter, deferredSearch, deferredSourceTab])

  // clear selection and sticky rows when filter or search changes
  useEffect(() => {
    clearSelection()
    setStickyRowIds(new Set())
  }, [deferredFilter, deferredSearch, deferredSourceTab, clearSelection])

  // single source of truth for which entries "select-all" covers
  const currentFilter: FilterSpec = {
    mode: deferredFilter,
    search: deferredSearch,
    sourceTab: deferredSourceTab
  }

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / pageSize))

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const pageEntries = filteredEntries.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const sideVirtualizer = useVirtualizer({
    count: pageEntries.length,
    getScrollElement: () => sideParentRef.current,
    estimateSize: () => 72,
    overscan: 10
  })

  const stackedVirtualizer = useVirtualizer({
    count: pageEntries.length,
    getScrollElement: () => stackedParentRef.current,
    estimateSize: () => 220,
    overscan: 10
  })

  const selectedStats = useMemo(() => {
    const materialized = materializeSelectedEntries(session)
    return {
      selectedStrings: materialized.length,
      selectedCharacters: materialized.reduce((sum, e) => sum + e.source.length, 0)
    }
  }, [session.selection, session.entries])

  const allFiltered =
    selection.kind === 'all-matching' &&
    selection.excluded.size === 0 &&
    selection.filter.mode === deferredFilter &&
    selection.filter.search === deferredSearch

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
    if (checked) {
      selectAllMatching(currentFilter)
    } else {
      clearSelection()
    }
  }

  const focusEntry = (rowId: string) => {
    textareaRefs.current.get(rowId)?.focus()
  }

  const handleCopySource = async (event: React.MouseEvent, source: string) => {
    event.stopPropagation()
    try {
      await navigator.clipboard.writeText(source)
      toast.success(t('translate.sourceCopied', { ns: 'toasts' }))
    } catch (err) {
      toast.error(getLocalizedErrorMessage(err, t))
    }
  }

  const updateEntryTarget = (entry: TranslationSessionEntry, value: string) => {
    if (value !== entry.target) {
      onEntryChange(entry.rowId, value)
      if (entry.matchType === 'none') onEntryManualEdit(entry.rowId)
    }
  }

  const markSticky = (rowId: string) => {
    if (deferredFilter === 'all' && !deferredSearch) return
    setStickyRowIds((prev) => {
      if (prev.has(rowId)) return prev
      const next = new Set(prev)
      next.add(rowId)
      return next
    })
  }

  const handleEntryBlur = (entry: TranslationSessionEntry, value: string) => {
    if (savedByEnterRef.current.has(entry.rowId)) {
      savedByEnterRef.current.delete(entry.rowId)
      return
    }
    updateEntryTarget(entry, value)
    markSticky(entry.rowId)
  }

  // Per-row "Translate with AI" chip - opens the modal with similarity examples and the
  // per-line prompt for that entry. Uses whichever provider is active in Settings.
  const renderAiButton = (entry: TranslationSessionEntry) => (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        setAiEntry(entry)
      }}
      className="inline-flex h-6 shrink-0 cursor-pointer items-center gap-1.5 rounded border border-[#1f2329] bg-[#131518] px-2 text-[11px] font-medium text-neutral-300 transition-colors hover:border-amber-500/60 hover:text-amber-400"
    >
      <span
        className="flex h-3.5 w-3.5 items-center justify-center rounded-sm font-mono text-[7px] font-bold text-white"
        style={{ background: aiMeta.color }}
      >
        {aiMeta.mark}
      </span>
      {t('grid.translateWith', { ns: 'ai', provider: aiMeta.short })}
    </button>
  )

  const aiModal = aiEntry && (
    <AITranslateModal
      open
      source={aiEntry.source}
      sourceLang={sourceLang}
      targetLang={targetLang}
      onApply={(result) => {
        updateEntryTarget(aiEntry, result)
        markSticky(aiEntry.rowId)
      }}
      onClose={() => setAiEntry(null)}
    />
  )

  const handleEnterKey = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    entry: TranslationSessionEntry
  ) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()

    const value = event.currentTarget.value
    updateEntryTarget(entry, value)
    markSticky(entry.rowId)
    savedByEnterRef.current.add(entry.rowId)

    if (value.trim()) onEntrySave(entry.rowId, value)

    const nextIndex = pageEntries.findIndex((item) => item.rowId === entry.rowId) + 1
    const nextEntry = pageEntries[nextIndex]
    if (!nextEntry) return

    const nextTextarea = textareaRefs.current.get(nextEntry.rowId)
    if (!nextTextarea) return
    nextTextarea.focus()
    nextTextarea.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }

  const btnBase =
    'inline-flex h-7 cursor-pointer items-center rounded border border-[#1f2329] bg-[#131518] px-2 text-xs font-medium text-neutral-400 transition-colors hover:border-[#2a2f37] hover:text-neutral-200 disabled:cursor-not-allowed disabled:opacity-40'

  const PaginationFooter = (
    <div className="flex shrink-0 items-center justify-between gap-4 border-t border-[#1f2329] bg-[#0c0d0f] px-5 py-2">
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        <span>{t('grid.pagination.pageSizeLabel', { ns: 'translate' })}</span>
        <select
          value={pageSize}
          onChange={(event) => {
            setPageSize(Number(event.target.value) as typeof pageSize)
            setCurrentPage(1)
          }}
          className="cursor-pointer rounded border border-[#1f2329] bg-[#131518] px-2 py-0.5 text-xs text-neutral-300 focus:outline-none"
        >
          {([100, 250, 500, 1000] as const).map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] tabular-nums text-neutral-500">
          {t('grid.pagination.pageOf', {
            ns: 'translate',
            current: currentPage,
            total: totalPages
          })}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={btnBase}
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(1)}
          >
            {t('grid.pagination.first', { ns: 'translate' })}
          </button>
          <button
            type="button"
            className={btnBase}
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            {t('grid.pagination.prev', { ns: 'translate' })}
          </button>
          <button
            type="button"
            className={btnBase}
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            {t('grid.pagination.next', { ns: 'translate' })}
          </button>
          <button
            type="button"
            className={btnBase}
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(totalPages)}
          >
            {t('grid.pagination.last', { ns: 'translate' })}
          </button>
        </div>
      </div>
    </div>
  )

  const filterItems: Array<{
    mode: FilterMode
    label: string
    count: number
    dot?: string
  }> = [
    {
      mode: 'untranslated',
      label: t('grid.untranslated', { ns: 'translate' }),
      count: counts.untranslated,
      dot: 'bg-slate-500'
    },
    {
      mode: 'translated',
      label: t('grid.translated', { ns: 'translate' }),
      count: counts.translated,
      dot: 'bg-amber-400'
    },
    {
      mode: 'dictionary',
      label: t('grid.dictionary', { ns: 'translate' }),
      count: counts.dictionary,
      dot: 'bg-blue-500'
    },
    {
      mode: 'tags',
      label: t('grid.tags', { ns: 'translate' }),
      count: counts.tags,
      dot: 'bg-purple-400'
    }
  ]

  const sourceTabs =
    hasLocaFiles && hasXmlFiles ? (
      <div className="flex shrink-0 items-center gap-1 rounded-md border border-[#1f2329] bg-[#131518] p-0.5">
        {[
          {
            mode: 'all' as SourceFileTab,
            label: t('grid.tabAll', { ns: 'translate' }),
            count: undefined
          },
          { mode: 'xml' as SourceFileTab, label: '.xml', count: tabCounts.xml },
          { mode: 'loca' as SourceFileTab, label: '.loca', count: tabCounts.loca }
        ].map((tab) => (
          <button
            key={tab.mode}
            type="button"
            onClick={() => startFilterTransition(() => setSourceTab(tab.mode))}
            className={cn(
              'flex h-7 cursor-pointer items-center gap-1.5 rounded px-2.5 text-xs font-semibold transition-colors',
              sourceTab === tab.mode
                ? 'bg-[#1f2329] text-neutral-100'
                : 'text-neutral-500 hover:bg-[#181b1f] hover:text-neutral-300'
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="rounded-full bg-[#181b1f] px-1.5 py-0.5 text-[10px] tabular-nums text-neutral-500">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
    ) : null

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
          placeholder={t('grid.searchPlaceholder', { ns: 'translate' })}
          className="min-w-0 flex-1 bg-transparent text-xs font-medium text-neutral-300 placeholder:text-neutral-600 focus:outline-none"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} className="shrink-0 cursor-pointer">
            <X size={13} className="text-neutral-500 transition-colors hover:text-neutral-300" />
          </button>
        )}
      </div>

      {sourceTabs}

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
          {t('grid.all', { ns: 'translate' })}
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

        <button
          type="button"
          aria-label={t('grid.refreshView', { ns: 'translate' })}
          title={t('grid.refreshView', { ns: 'translate' })}
          disabled={stickyRowIds.size === 0}
          onClick={() => setStickyRowIds(new Set())}
          className={cn(btnBase, 'gap-1.5 disabled:cursor-not-allowed disabled:opacity-40')}
        >
          <RefreshCw size={12} />
          {stickyRowIds.size > 0 && (
            <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-amber-400">
              {t('grid.refreshViewHidden', { ns: 'translate', count: stickyRowIds.size })}
            </span>
          )}
        </button>
      </div>

      <div className="ml-auto flex items-center gap-3 text-xs font-semibold text-neutral-400">
        {isPending && (
          <span className="rounded-full border border-[#252a32] bg-[#181b1f] px-2 py-0.5 text-[10px] font-mono text-amber-400">
            {t('status.updating', { ns: 'common' })}
          </span>
        )}
        <span className="font-mono tabular-nums text-neutral-500">
          {t('grid.selectedStats', {
            ns: 'translate',
            strings: selectedStats.selectedStrings,
            characters: selectedStats.selectedCharacters
          })}
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
          <div className="px-4 py-2 text-[10px] font-semibold tracking-[0.08em] text-neutral-500 uppercase">
            {t('grid.sourceHeader', {
              ns: 'translate',
              language: sourceLang.toUpperCase()
            })}
          </div>
          <div className="border-l border-[#1f2329] px-4 py-2 text-[10px] font-semibold tracking-[0.08em] text-neutral-500 uppercase">
            {t('grid.translationHeader', {
              ns: 'translate',
              language: targetLang.toUpperCase()
            })}
          </div>
        </div>

        <div
          ref={sideParentRef}
          className="icosa-scroll min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]"
        >
          <div style={{ height: sideVirtualizer.getTotalSize(), position: 'relative' }}>
            {sideVirtualizer.getVirtualItems().map((virtualItem) => {
              const entry = pageEntries[virtualItem.index]
              const category = getCategory(entry)
              const isDone = entry.target.trim() !== ''
              const isRowSelected = isSelected(entry.rowId)
              const isDictionary = category === 'dictionary'
              const charCount = entry.source.length
              const globalIndex = (currentPage - 1) * pageSize + virtualItem.index

              return (
                <div
                  key={entry.rowId}
                  data-index={virtualItem.index}
                  ref={sideVirtualizer.measureElement}
                  className={cn(
                    'group grid border-b border-[#1f2329] transition-colors hover:bg-[#131518]/60 focus-within:bg-[#131518] focus-within:shadow-[inset_3px_0_0_#f59e0b]',
                    isRowSelected && 'bg-blue-950/10'
                  )}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                    gridTemplateColumns: '80px 1fr 1fr'
                  }}
                >
                  <div
                    className="flex cursor-pointer flex-col items-center gap-2 border-r border-[#1f2329] bg-[#0f1114] px-3 py-3"
                    onClick={() => focusEntry(entry.rowId)}
                  >
                    <input
                      type="checkbox"
                      checked={isRowSelected}
                      onChange={() => toggleEntry(entry.rowId)}
                      onClick={(event) => event.stopPropagation()}
                      className="cursor-pointer accent-amber-500"
                    />
                    <span className="font-mono text-[11px] tabular-nums text-neutral-600">
                      {String(globalIndex + 1).padStart(3, '0')}
                    </span>
                    <span
                      className={cn(
                        'mt-auto h-1.5 w-1.5 rounded-full transition-colors',
                        isDone ? 'bg-amber-500' : 'bg-neutral-700'
                      )}
                    />
                  </div>

                  <div className="flex min-w-0 cursor-text flex-col gap-2 px-4 py-3">
                    <div className="wrap-break-word font-mono text-[13px] leading-[1.6] text-neutral-200 whitespace-pre-wrap">
                      {entry.source ? (
                        renderSource(entry.source)
                      ) : (
                        <span className="italic text-neutral-600">
                          {t('grid.emptySource', { ns: 'translate' })}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isDictionary && (
                        <span className="inline-flex items-center gap-1 rounded bg-blue-500/12 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-400">
                          <BookOpen size={10} /> D <span className="text-blue-500/70">1</span>
                        </span>
                      )}
                      {entry.sourceFile && (
                        <span
                          title={entry.sourceFile}
                          className="inline-flex max-w-40 items-center truncate rounded border border-[#1f2329] bg-[#131518] px-1.5 font-mono text-[10px] text-neutral-500"
                        >
                          {entry.sourceFile}
                        </span>
                      )}
                      <span className="font-mono text-[10px] text-neutral-600">
                        {t('grid.charCount', { ns: 'translate', count: charCount })}
                      </span>
                      <span className="ml-auto">
                        <button
                          type="button"
                          aria-label={t('grid.copySource', { ns: 'translate' })}
                          title={t('grid.copySource', { ns: 'translate' })}
                          className="inline-flex h-6 cursor-pointer items-center gap-1 rounded bg-transparent px-2 text-[11px] text-neutral-400 transition-colors hover:bg-[#1c1f24] hover:text-neutral-200"
                          onClick={(event) => handleCopySource(event, entry.source)}
                        >
                          <Copy size={11} />
                        </button>
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
                      placeholder={t('grid.translationPlaceholder', { ns: 'translate' })}
                      containerClassName="rounded-md"
                      className="field-sizing-content"
                    />
                    <div className="flex items-center gap-1.5">
                      {renderAiButton(entry)}
                      <div className="pointer-events-none flex flex-1 items-center gap-1.5 opacity-0 transition-opacity duration-150 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                        <button
                          type="button"
                          className="inline-flex h-6 cursor-pointer items-center gap-1 rounded bg-transparent px-2 text-[11px] text-neutral-400 transition-colors hover:bg-[#1c1f24] hover:text-neutral-200"
                        >
                          <BookOpen size={11} /> {t('grid.applyDictionary', { ns: 'translate' })}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {PaginationFooter}
        {aiModal}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {searchBar}

      <div className="flex shrink-0 select-none items-center gap-2 border-b border-[#1f2329] bg-[#0f1114] px-7 py-2">
        <input
          type="checkbox"
          checked={allFiltered}
          onChange={(event) => handleSelectAll(event.target.checked)}
          className="cursor-pointer accent-amber-500"
        />
        <span className="text-[11px] font-medium tabular-nums text-neutral-500">
          {t('grid.entries', { ns: 'translate', count: filteredEntries.length })}
        </span>
      </div>

      <div ref={stackedParentRef} className="icosa-scroll min-h-0 flex-1 overflow-y-auto">
        {/* 44px = pt-5 (20px) + pb-6 (24px) added to total size so padding is preserved */}
        <div style={{ height: stackedVirtualizer.getTotalSize() + 44, position: 'relative' }}>
          {stackedVirtualizer.getVirtualItems().map((virtualItem) => {
            const entry = pageEntries[virtualItem.index]
            const category = getCategory(entry)
            const isDone = entry.target.trim() !== ''
            const isRowSelected = isSelected(entry.rowId)
            const isDictionary = category === 'dictionary'
            const hasTags = hasXmlTags(entry)
            const wordCount = entry.source.split(/\s+/).filter(Boolean).length
            const charCount = entry.source.length
            const rows = Math.max(2, Math.ceil(charCount / 70))
            const globalIndex = (currentPage - 1) * pageSize + virtualItem.index

            return (
              <div
                key={entry.rowId}
                data-index={virtualItem.index}
                ref={stackedVirtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  // 20px offset = pt-5 top padding
                  transform: `translateY(${virtualItem.start + 20}px)`,
                  paddingLeft: '28px',
                  paddingRight: '28px',
                  paddingBottom: '14px'
                }}
              >
                <div className="mx-auto max-w-275">
                  <div
                    className={cn(
                      'group grid cursor-default overflow-hidden rounded-xl border transition-all duration-120',
                      'border-[#1f2329] bg-[#0f1114]',
                      'hover:-translate-y-px hover:border-[#2a2f37] hover:shadow-[0_4px_16px_rgba(0,0,0,0.18)]',
                      'focus-within:border-amber-500 focus-within:shadow-[0_0_0_3px_rgba(245,158,11,0.25),0_8px_24px_rgba(0,0,0,0.24)]',
                      isRowSelected && 'border-blue-700/40 bg-blue-950/10'
                    )}
                    style={{ gridTemplateColumns: '56px 1fr' }}
                    onClick={() => focusEntry(entry.rowId)}
                  >
                    <div className="flex flex-col items-center gap-3 border-r border-[#1f2329] bg-[#0c0d0f] py-4.5">
                      <input
                        type="checkbox"
                        checked={isRowSelected}
                        onChange={() => toggleEntry(entry.rowId)}
                        onClick={(event) => event.stopPropagation()}
                        className="cursor-pointer accent-amber-500"
                      />

                      <span
                        className="mt-auto font-mono text-[11px] tracking-widest text-neutral-600"
                        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                      >
                        #{String(globalIndex + 1).padStart(3, '0')}
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
                        <LangTag>{sourceLang.toUpperCase()}</LangTag>
                        <span className="font-mono text-[10px] tracking-[0.02em] text-neutral-600">
                          {t('grid.wordAndCharCount', {
                            ns: 'translate',
                            chars: charCount,
                            words: wordCount
                          })}
                        </span>
                        <span className="flex-1" />
                        {isDictionary && (
                          <span className="inline-flex items-center gap-1 rounded bg-blue-500/12 px-2 py-0.5 text-[11px] font-medium text-blue-400">
                            <BookOpen size={11} />
                            {entry.matchType === 'mod-text'
                              ? t('grid.dictionaryTagMod', { ns: 'translate' })
                              : t('grid.dictionaryTag', { ns: 'translate' })}
                          </span>
                        )}
                        {hasTags && (
                          <span className="inline-flex items-center gap-1 rounded bg-purple-500/14 px-2 py-0.5 text-[11px] font-medium text-purple-300">
                            <AlertTriangle size={11} />{' '}
                            {t('grid.containsTags', { ns: 'translate' })}
                          </span>
                        )}
                        {entry.sourceFile && (
                          <span
                            title={entry.sourceFile}
                            className="inline-flex max-w-45 items-center truncate rounded border border-[#1f2329] bg-[#131518] px-2 py-0.5 font-mono text-[10px] text-neutral-500"
                          >
                            {entry.sourceFile}
                          </span>
                        )}
                        <button
                          type="button"
                          aria-label={t('grid.copySource', { ns: 'translate' })}
                          title={t('grid.copySource', { ns: 'translate' })}
                          className="inline-flex h-6 cursor-pointer items-center gap-1 rounded bg-transparent px-2 text-[11px] text-neutral-400 transition-colors hover:bg-[#1c1f24] hover:text-neutral-200"
                          onClick={(event) => handleCopySource(event, entry.source)}
                        >
                          <Copy size={11} />
                        </button>
                      </div>

                      <div className="wrap-break-word font-mono text-[14px] leading-[1.65] text-neutral-200 whitespace-pre-wrap">
                        {entry.source ? (
                          renderSource(entry.source)
                        ) : (
                          <span className="italic text-neutral-600">
                            {t('grid.emptySource', { ns: 'translate' })}
                          </span>
                        )}
                      </div>

                      {isDictionary && (
                        <div className="hidden flex-wrap items-center gap-2 rounded-lg border border-dashed border-[#2a2f37] bg-[#0c0d0f] px-3 py-2 group-focus-within:flex">
                          <span className="text-[11px] font-semibold tracking-[0.08em] text-neutral-500 uppercase">
                            {t('grid.dictionarySuggestion', { ns: 'translate' })}
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
                              {entry.source.length > 24 ? '...' : ''}
                            </span>
                            <span className="text-neutral-600">-&gt;</span>
                            <span className="font-medium text-neutral-200">
                              {entry.target || '-'}
                            </span>
                          </button>
                        </div>
                      )}

                      <div className="mt-1 flex items-center gap-2.5 border-t border-dashed border-[#1f2329] pt-1">
                        <LangTag accent>{targetLang.toUpperCase()}</LangTag>
                        {renderAiButton(entry)}
                        <div className="pointer-events-none flex flex-1 items-center gap-1.5 opacity-0 transition-opacity duration-150 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
                          <button
                            type="button"
                            className="inline-flex h-6 cursor-pointer items-center gap-1 rounded bg-transparent px-2 text-[11px] text-neutral-400 transition-colors hover:bg-[#1c1f24] hover:text-neutral-200"
                          >
                            <Check size={11} /> {t('grid.markTranslated', { ns: 'translate' })}
                          </button>
                          <span className="flex-1" />
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
                        placeholder={isDone ? '' : t('grid.startTyping', { ns: 'translate' })}
                        containerClassName="min-h-11 rounded-lg border-[#1f2329] bg-[#0c0d0f] focus-within:border-amber-500 focus-within:shadow-[0_0_0_3px_rgba(245,158,11,0.25)]"
                        overlayClassName="px-3.5 py-3 text-[13px] leading-[1.6]"
                        className="min-h-11 px-3.5 py-3 text-[13px] leading-[1.6]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {PaginationFooter}
      {aiModal}
    </div>
  )
}
