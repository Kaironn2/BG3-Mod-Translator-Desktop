import {
  BookOpen,
  Box,
  ChevronLeft,
  ChevronRight,
  Download,
  FilterX,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Wifi,
  X
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { DictionaryEntryModal } from '@/components/dictionary/DictionaryEntryModal'
import { DictionaryImportModal } from '@/components/dictionary/DictionaryImportModal'
import { DictionaryReplaceModal } from '@/components/dictionary/DictionaryReplaceModal'
import { applyTextReplace } from '@/components/dictionary/replace'
import {
  decodeDictionaryTextForUi,
  encodeDictionaryTextForPersistence
} from '@/components/dictionary/text'
import {
  EMPTY_ENTRY_DRAFT,
  type DisplayEntry,
  type EntryDraft,
  type ReplaceDraft
} from '@/components/dictionary/types'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ThemedSelect, type ThemedSelectOption } from '@/components/shared/ThemedSelect'
import { useDebouncedFilter } from '@/hooks/useDebouncedFilter'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { cn } from '@/lib/utils'
import type { DictionaryEntry, DictionaryFilters, Language } from '@/types'
import { renderSource } from '@/utils/renderSource'
import { formatRelativeDate } from '../features/translate/utils/relativeDate'

interface PendingDeleteState {
  ids: number[]
  title: string
  description: string
}

interface FilterOption {
  value: string
  label: string
  count?: number
}

interface DictionaryResultState {
  items: DictionaryEntry[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

type DictionaryLoadingMode = 'overlay' | 'replace'

const TABLE_HEADER =
  'select-none text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500'
const DEFAULT_PAGE_SIZE = 200
const MAX_PAGE_SIZE = 1000
const PAGE_SIZE_OPTIONS = [50, 100, 200, 500, 1000]

export function DictionaryPage(): React.JSX.Element {
  const { t, currentLanguage } = useAppTranslation(['dictionary', 'common', 'toasts'])
  const [result, setResult] = useState<DictionaryResultState>({
    items: [],
    total: 0,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    totalPages: 1
  })
  const [languages, setLanguages] = useState<Language[]>([])
  const [knownMods, setKnownMods] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMode, setLoadingMode] = useState<DictionaryLoadingMode>('overlay')
  const [bootstrapping, setBootstrapping] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)
  const [text, setText] = useState('')
  const [modName, setModName] = useState('')
  const [sourceLang, setSourceLang] = useState('')
  const [targetLang, setTargetLang] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [importOpen, setImportOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [createSeed, setCreateSeed] = useState<EntryDraft>(EMPTY_ENTRY_DRAFT)
  const [editingEntry, setEditingEntry] = useState<DisplayEntry | null>(null)
  const [pendingDelete, setPendingDelete] = useState<PendingDeleteState | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const nextLoadingModeRef = useRef<DictionaryLoadingMode>('overlay')
  const debouncedText = useDebouncedFilter(text)

  const filters = useMemo<DictionaryFilters>(
    () => ({
      text: debouncedText || undefined,
      modName: modName || undefined,
      sourceLang: sourceLang || undefined,
      targetLang: targetLang || undefined
    }),
    [debouncedText, modName, sourceLang, targetLang]
  )

  const normalizePageSize = useCallback((value: string | number | null | undefined): number => {
    const parsed = typeof value === 'number' ? value : Number.parseInt(value ?? '', 10)
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PAGE_SIZE
    return Math.min(MAX_PAGE_SIZE, parsed)
  }, [])

  const loadEntries = useCallback(
    async (
      nextFilters: DictionaryFilters,
      nextPage: number,
      nextPageSize: number,
      options?: { silent?: boolean; mode?: DictionaryLoadingMode }
    ) => {
      const mode = options?.mode ?? 'overlay'
      setLoadingMode(mode)
      if (mode === 'replace') {
        setResult((previous) => ({ ...previous, items: [] }))
      }
      if (!options?.silent) setLoading(true)
      try {
        const response = await window.api.dictionary.list({
          filters: nextFilters,
          page: nextPage,
          pageSize: nextPageSize
        })
        setResult(response)
        if (response.page !== nextPage) setPage(response.page)
      } catch (error) {
        toast.error(getLocalizedErrorMessage(error, t))
      } finally {
        if (!options?.silent) setLoading(false)
      }
    },
    [t]
  )

  const loadReferenceData = useCallback(async () => {
    try {
      const [languageRows, modRows, config] = await Promise.all([
        window.api.language.getAll(),
        window.api.mod.getAll(),
        window.api.config.getAll()
      ])
      setLanguages(languageRows)
      setKnownMods(modRows.map((row) => row.name))
      setPageSize(normalizePageSize(config.dictionary_page_size))
    } catch (error) {
      toast.error(getLocalizedErrorMessage(error, t))
    } finally {
      setBootstrapping(false)
    }
  }, [normalizePageSize, t])

  useEffect(() => {
    loadReferenceData()
  }, [loadReferenceData])

  useEffect(() => {
    setPage(1)
    setSelectedIds(new Set())
  }, [filters])

  useEffect(() => {
    if (bootstrapping) return
    const mode = nextLoadingModeRef.current
    nextLoadingModeRef.current = 'overlay'
    void loadEntries(filters, page, pageSize, { mode })
  }, [bootstrapping, filters, loadEntries, page, pageSize])

  useEffect(() => {
    const onFind = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) return
      if (event.key.toLowerCase() !== 'f') return
      event.preventDefault()
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    }

    window.addEventListener('keydown', onFind)
    return () => window.removeEventListener('keydown', onFind)
  }, [])

  const languageNames = useMemo(
    () => new Map(languages.map((language) => [language.code, language.name])),
    [languages]
  )

  const displayEntries = useMemo(
    () => result.items.map((entry) => toDisplayEntry(entry, filters)),
    [filters, result.items]
  )

  const modOptions = useMemo(
    () => buildModOptions(displayEntries, knownMods),
    [displayEntries, knownMods]
  )

  const sourceOptions = useMemo(
    () => buildLanguageOptions(displayEntries, 'source'),
    [displayEntries]
  )

  const targetOptions = useMemo(
    () => buildLanguageOptions(displayEntries, 'target'),
    [displayEntries]
  )

  const modSelectOptions = useMemo<ThemedSelectOption[]>(
    () => [
      { value: '', label: t('filters.allMods', { ns: 'dictionary' }), badge: `${result.total}` },
      ...modOptions.map((option) => ({
        value: option.value,
        label: option.label,
        badge: `${option.count ?? 0}`,
        searchText: option.label
      }))
    ],
    [modOptions, result.total, t]
  )

  const sourceSelectOptions = useMemo<ThemedSelectOption[]>(
    () => [
      { value: '', label: t('filters.all', { ns: 'dictionary' }), badge: `${result.total}` },
      ...languages.map((language) => ({
        value: language.code,
        label: language.code.toUpperCase(),
        badge: `${sourceOptions.get(language.code) ?? 0}`,
        searchText: `${languageNames.get(language.code) ?? language.code} ${language.code}`
      }))
    ],
    [languageNames, languages, result.total, sourceOptions, t]
  )

  const targetSelectOptions = useMemo<ThemedSelectOption[]>(
    () => [
      { value: '', label: t('filters.all', { ns: 'dictionary' }), badge: `${result.total}` },
      ...languages.map((language) => ({
        value: language.code,
        label: language.code.toUpperCase(),
        badge: `${targetOptions.get(language.code) ?? 0}`,
        searchText: `${languageNames.get(language.code) ?? language.code} ${language.code}`
      }))
    ],
    [languageNames, languages, result.total, targetOptions, t]
  )

  const stats = useMemo(() => {
    const modCount = new Set(displayEntries.map((entry) => entry.modName || '__none__')).size
    const pairCount = new Set(
      displayEntries.map((entry) => `${entry.sourceLang}->${entry.targetLang}`)
    ).size
    const latest = displayEntries.find((entry) => entry.updatedAt)?.updatedAt ?? null
    return {
      total: result.total,
      filtered: displayEntries.length,
      modCount,
      pairCount,
      latest
    }
  }, [displayEntries, result.total])

  const allFilteredSelected =
    displayEntries.length > 0 && displayEntries.every((entry) => selectedIds.has(entry.id))
  const hasFilters = Boolean(text || modName || sourceLang || targetLang)
  const selectedCount = selectedIds.size
  const pageStart = result.total === 0 ? 0 : (result.page - 1) * result.pageSize + 1
  const pageEnd = result.total === 0 ? 0 : pageStart + displayEntries.length - 1

  const refreshCurrentPage = useCallback(async () => {
    await loadEntries(filters, page, pageSize, { silent: true })
  }, [filters, loadEntries, page, pageSize])

  const startCreate = () => {
    setCreateSeed({
      sourceLang: sourceLang || 'en',
      targetLang: targetLang || 'pt-BR',
      sourceText: '',
      targetText: '',
      modName,
      uid: ''
    })
    setCreateOpen(true)
  }

  const handleCreate = async (draft: EntryDraft): Promise<boolean> => {
    try {
      await window.api.dictionary.create({
        language1: draft.sourceLang,
        language2: draft.targetLang,
        textLanguage1: encodeDictionaryTextForPersistence(draft.sourceText),
        textLanguage2: encodeDictionaryTextForPersistence(draft.targetText),
        modName: draft.modName || null,
        uid: draft.uid || null
      })
      toast.success(t('dictionary.created', { ns: 'toasts' }))
      setCreateOpen(false)
      await Promise.all([refreshCurrentPage(), loadReferenceData()])
      return true
    } catch (error) {
      toast.error(getLocalizedErrorMessage(error, t))
      return false
    }
  }

  const handleUpdate = async (draft: EntryDraft): Promise<boolean> => {
    if (!editingEntry) return false

    try {
      await window.api.dictionary.update({
        id: editingEntry.id,
        entry: {
          language1: draft.sourceLang,
          language2: draft.targetLang,
          textLanguage1: encodeDictionaryTextForPersistence(draft.sourceText),
          textLanguage2: encodeDictionaryTextForPersistence(draft.targetText),
          modName: draft.modName || null,
          uid: draft.uid || null
        }
      })
      toast.success(t('dictionary.updated', { ns: 'toasts' }))
      setEditingEntry(null)
      await Promise.all([refreshCurrentPage(), loadReferenceData()])
      return true
    } catch (error) {
      toast.error(getLocalizedErrorMessage(error, t))
      return false
    }
  }

  const handleDeleteMany = async (ids: number[]) => {
    try {
      for (const id of ids) {
        await window.api.dictionary.delete({ id })
      }
      toast.success(
        t(ids.length === 1 ? 'dictionary.deleted_one' : 'dictionary.deleted_other', {
          ns: 'toasts',
          count: ids.length
        })
      )
      setPendingDelete(null)
      setSelectedIds(new Set())
      await refreshCurrentPage()
    } catch (error) {
      toast.error(getLocalizedErrorMessage(error, t))
    }
  }

  const handleBatchReplace = async (draft: ReplaceDraft): Promise<boolean> => {
    const selectedEntries = displayEntries.filter((entry) => selectedIds.has(entry.id))
    const updates = selectedEntries
      .map((entry) => {
        const nextSource =
          draft.scope === 'source' || draft.scope === 'both'
            ? applyTextReplace(entry.sourceText, draft)
            : entry.sourceText
        const nextTarget =
          draft.scope === 'target' || draft.scope === 'both'
            ? applyTextReplace(entry.targetText, draft)
            : entry.targetText

        if (nextSource === entry.sourceText && nextTarget === entry.targetText) return null

        return {
          id: entry.id,
          entry: {
            language1: entry.sourceLang,
            language2: entry.targetLang,
            textLanguage1: encodeDictionaryTextForPersistence(nextSource),
            textLanguage2: encodeDictionaryTextForPersistence(nextTarget),
            modName: entry.modName || null,
            uid: entry.uid || null
          }
        }
      })
      .filter((update): update is NonNullable<typeof update> => update !== null)

    if (updates.length === 0) {
      toast.info(t('dictionary.replaceNone', { ns: 'toasts' }))
      return false
    }

    try {
      for (const update of updates) {
        await window.api.dictionary.update(update)
      }
      toast.success(t('dictionary.replaceApplied', { ns: 'toasts', count: updates.length }))
      setReplaceOpen(false)
      await Promise.all([refreshCurrentPage(), loadReferenceData()])
      return true
    } catch (error) {
      toast.error(getLocalizedErrorMessage(error, t))
      return false
    }
  }

  const handleExport = async () => {
    const outputPath = await window.api.fs.saveDialog({
      defaultName: buildExportName(filters),
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (!outputPath) return

    try {
      await window.api.dictionary.export({
        filters,
        format: 'csv',
        outputPath
      })
      toast.success(t('dictionary.csvExported', { ns: 'toasts' }))
    } catch (error) {
      toast.error(getLocalizedErrorMessage(error, t))
    }
  }

  const handlePageSizeChange = async (value: string) => {
    const nextPageSize = normalizePageSize(value)
    setSelectedIds(new Set())
    nextLoadingModeRef.current = 'replace'
    setPageSize(nextPageSize)
    setPage(1)
    await window.api.config.set({
      key: 'dictionary_page_size',
      value: String(nextPageSize)
    })
  }

  const toggleSelected = (id: number, checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const toggleSelectAll = (checked: boolean) => {
    setSelectedIds(() => {
      const next = new Set<number>()
      if (checked) {
        for (const entry of displayEntries) next.add(entry.id)
      }
      return next
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0f1114] text-neutral-100">
      <header className="flex items-center justify-between border-b border-[#1f2329] px-5 py-3">
        <div className="flex min-w-0 items-center gap-4">
          <div className="inline-flex items-center gap-2 rounded-md border border-[#1f2329] bg-[#131518] px-2.5 py-1.5">
            <BookOpen size={14} className="text-amber-400" />
            <span className="text-sm font-semibold text-neutral-200">{t('brand', { ns: 'dictionary' })}</span>
            <span className="font-mono text-[11px] text-neutral-500">.icosa</span>
          </div>
          <div className="hidden items-center gap-3 text-xs text-neutral-400 md:flex">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              {t('stats.entries', { ns: 'dictionary', count: stats.total })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Box size={12} />
              {t('stats.mods', { ns: 'dictionary', count: stats.modCount })}
            </span>
            <span className="font-mono text-neutral-500">
              {t('sync', {
                ns: 'dictionary',
                value: stats.latest
                  ? formatRelativeDate(stats.latest, currentLanguage)
                  : t('status.now', { ns: 'common' })
              })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={loading || stats.total === 0}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-neutral-700 bg-[#131518] px-3 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download size={13} />
            {t('actions.exportCsv', { ns: 'dictionary' })}
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-amber-500 bg-amber-500 px-3 text-xs font-semibold text-neutral-950 transition-colors hover:border-amber-400 hover:bg-amber-400"
          >
            <Upload size={13} />
            {t('actions.importCsv', { ns: 'dictionary' })}
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-end gap-x-2 gap-y-3 border-b border-[#1f2329] bg-[#0f1114] px-4 py-3">
        <div className="flex h-8 min-w-70 flex-1 self-end items-center gap-2 rounded-md border border-[#1f2329] bg-[#131518] px-3 focus-within:border-neutral-600">
          <Search size={14} className="text-neutral-500" />
          <input
            ref={searchInputRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t('filters.searchPlaceholder', { ns: 'dictionary' })}
            className="min-w-0 flex-1 bg-transparent text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none"
          />
          {text && (
            <button
              type="button"
              onClick={() => setText('')}
              className="cursor-pointer text-neutral-500"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <FilterSelect
          label={t('filters.mod', { ns: 'dictionary' })}
          value={modName}
          options={modSelectOptions}
          onChange={setModName}
          className="w-[11.5rem]"
          menuMinWidth={220}
          t={t}
        />
        <FilterSelect
          label={t('filters.sourceLanguage', { ns: 'dictionary' })}
          value={sourceLang}
          options={sourceSelectOptions}
          onChange={setSourceLang}
          className="w-40"
          menuMinWidth={176}
          t={t}
        />
        <FilterSelect
          label={t('filters.targetLanguage', { ns: 'dictionary' })}
          value={targetLang}
          options={targetSelectOptions}
          onChange={setTargetLang}
          className="w-40"
          menuMinWidth={176}
          t={t}
        />

        <PageSizeSelect value={pageSize} onChange={handlePageSizeChange} t={t} />

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setText('')
              setModName('')
              setSourceLang('')
              setTargetLang('')
            }}
            className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-dashed border-[#3a404a] px-3 text-xs text-neutral-400 transition-colors hover:bg-[#131518] hover:text-neutral-200"
          >
            <FilterX size={12} />
            {t('actions.clear', { ns: 'common' })}
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] font-medium text-neutral-500">
            {selectedCount > 0
              ? t('selection.count', { ns: 'dictionary', count: selectedCount })
              : t('selection.none', { ns: 'dictionary' })}
          </span>
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={() =>
              setPendingDelete({
                ids: Array.from(selectedIds),
                title: t('dialogs.deleteSelectionTitle', { ns: 'dictionary' }),
                description: t('dialogs.deleteSelectionDescription', {
                  ns: 'dictionary',
                  count: selectedCount
                })
              })
            }
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/8 px-3 text-xs font-medium text-red-200 transition-colors hover:bg-red-500/14 disabled:cursor-not-allowed disabled:border-[#252a32] disabled:bg-[#131518] disabled:text-neutral-500"
          >
            <Trash2 size={13} />
            {t('actions.delete', { ns: 'common' })}
          </button>
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={() => setReplaceOpen(true)}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-neutral-700 bg-[#131518] px-3 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t('actions.replace', { ns: 'common' })}
          </button>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-amber-500 bg-amber-500 px-3 text-xs font-semibold text-neutral-950 transition-colors hover:border-amber-400 hover:bg-amber-400"
          >
            <Plus size={13} />
            {t('actions.newEntry', { ns: 'dictionary' })}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-6 border-b border-[#1f2329] bg-[#131518] px-4 py-3">
        <StatBlock
          label={t('stats.showing', { ns: 'dictionary' })}
          value={`${pageStart}-${pageEnd}`}
          detail={`/ ${stats.total}`}
          accentValue
        />
        <StatBlock
          label={t('stats.page', { ns: 'dictionary' })}
          value={`${result.page}`}
          detail={`/ ${result.totalPages}`}
        />
        <StatBlock label={t('stats.modsLabel', { ns: 'dictionary' })} value={`${stats.modCount}`} />
        <StatBlock
          label={t('stats.languagePairs', { ns: 'dictionary' })}
          value={`${stats.pairCount}`}
        />
        <div className="ml-auto text-right">
          <div className="text-[10px] font-semibold tracking-[0.08em] text-neutral-500 uppercase">
            {t('stats.lastEdit', { ns: 'dictionary' })}
          </div>
          <div className="font-mono text-[11px] text-neutral-400">
            {stats.latest
              ? formatRelativeDate(stats.latest, currentLanguage)
              : t('status.empty', { ns: 'common' })}
          </div>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div className="icosa-scroll h-full overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-[#131518]">
              <tr className="border-b border-[#1f2329]">
                <th className={cn(TABLE_HEADER, 'w-12 px-4 py-3 text-center')}>
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={(event) => toggleSelectAll(event.target.checked)}
                    className="h-4 w-4 cursor-pointer accent-amber-500"
                  />
                </th>
                <th className={cn(TABLE_HEADER, 'w-28 px-4 py-3 text-left')}>
                  {t('table.id', { ns: 'dictionary' })}
                </th>
                <th className={cn(TABLE_HEADER, 'px-4 py-3 text-left')}>
                  {t('table.sourceText', { ns: 'dictionary' })}
                </th>
                <th className={cn(TABLE_HEADER, 'px-4 py-3 text-left')}>
                  {t('table.targetText', { ns: 'dictionary' })}
                </th>
                <th className={cn(TABLE_HEADER, 'w-48 px-4 py-3 text-left')}>
                  {t('table.mod', { ns: 'dictionary' })}
                </th>
                <th className={cn(TABLE_HEADER, 'w-36 px-4 py-3 text-left')}>
                  {t('table.languages', { ns: 'dictionary' })}
                </th>
                <th className={cn(TABLE_HEADER, 'w-32 px-4 py-3 text-right')}>
                  {t('table.actions', { ns: 'dictionary' })}
                </th>
              </tr>
            </thead>
            <tbody>
              {displayEntries.map((entry) => (
                <tr
                  key={entry.id}
                  className={cn(
                    'border-b border-[#1f2329] transition-colors hover:bg-[#131518]',
                    selectedIds.has(entry.id) && 'bg-[#131518]'
                  )}
                >
                  <td className="px-4 py-3 align-top text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(entry.id)}
                      onChange={(event) => toggleSelected(entry.id, event.target.checked)}
                      className="mt-1 h-4 w-4 cursor-pointer accent-amber-500"
                    />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className="font-mono text-[11px] text-neutral-500">{entry.id}</span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="wrap-break-word font-mono text-sm leading-6 text-neutral-100 whitespace-pre-wrap">
                      {entry.sourceText ? renderSource(entry.sourceText) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="wrap-break-word font-mono text-sm leading-6 text-neutral-200 whitespace-pre-wrap">
                      {entry.targetText ? renderSource(entry.targetText) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-col gap-2">
                      <span className="inline-flex max-w-full items-center gap-2 rounded-md border border-[#252a32] bg-[#0c0d0f] px-2 py-1 text-xs text-neutral-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                        <span className="truncate">
                          {entry.modName || t('table.noMod', { ns: 'dictionary' })}
                        </span>
                      </span>
                      {entry.uid && (
                        <span className="truncate font-mono text-[11px] text-neutral-600">
                          {t('table.uid', { ns: 'dictionary', uid: entry.uid })}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-neutral-400">
                      <span>{entry.sourceLang.toUpperCase()}</span>
                      <span className="text-neutral-600">-&gt;</span>
                      <span className="text-amber-400">{entry.targetLang.toUpperCase()}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingEntry(entry)}
                        className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-transparent text-neutral-400 transition-colors hover:border-[#252a32] hover:bg-[#131518] hover:text-neutral-200"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setPendingDelete({
                            ids: [entry.id],
                            title: t('dialogs.deleteEntryTitle', { ns: 'dictionary' }),
                            description: t('dialogs.deleteEntryDescription', {
                              ns: 'dictionary',
                              id: entry.id
                            })
                          })
                        }
                        className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-transparent text-neutral-400 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && displayEntries.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-20">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#252a32] bg-[#131518] text-neutral-400">
                        <BookOpen size={20} />
                      </div>
                      <div className="text-sm font-semibold text-neutral-200">
                        {t('table.noEntries', { ns: 'dictionary' })}
                      </div>
                      <div className="text-xs text-neutral-500">
                        {t('table.noEntriesDescription', { ns: 'dictionary' })}
                      </div>
                    </div>
                  </td>
                </tr>
              )}

              {bootstrapping && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-sm text-neutral-500">
                    {t('table.preparing', { ns: 'dictionary' })}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {loading && <DictionaryLoadingOverlay mode={loadingMode} />}
      </div>

      <footer className="flex items-center gap-4 border-t border-[#1f2329] bg-[#0c0d0f] px-4 py-2 text-[11px] text-neutral-500">
        <span className="inline-flex items-center gap-1.5">
          <Wifi size={11} className="text-amber-400" />
          {t('status.connected', { ns: 'common' })}
        </span>
        <span>{t('footer.encoding', { ns: 'dictionary' })}</span>
        <span>{t('footer.file', { ns: 'dictionary' })}</span>
        <span className="flex-1" />
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={result.page <= 1 || loading}
            onClick={() => {
              setSelectedIds(new Set())
              setPage((current) => Math.max(1, current - 1))
            }}
            className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-[#252a32] px-2.5 text-neutral-300 transition-colors hover:bg-[#131518] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft size={12} />
            {t('actions.previous', { ns: 'common' })}
          </button>
          <span className="font-mono">
            {t('footer.range', {
              ns: 'dictionary',
              start: pageStart,
              end: pageEnd,
              total: stats.total
            })}
          </span>
          <button
            type="button"
            disabled={result.page >= result.totalPages || loading}
            onClick={() => {
              setSelectedIds(new Set())
              setPage((current) => Math.min(result.totalPages, current + 1))
            }}
            className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-md border border-[#252a32] px-2.5 text-neutral-300 transition-colors hover:bg-[#131518] disabled:cursor-not-allowed disabled:opacity-30"
          >
            {t('actions.next', { ns: 'common' })}
            <ChevronRight size={12} />
          </button>
        </div>
      </footer>

      <DictionaryEntryModal
        open={createOpen}
        mode="create"
        initialDraft={createSeed}
        languages={languages}
        mods={knownMods}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DictionaryEntryModal
        open={Boolean(editingEntry)}
        mode="edit"
        entryId={editingEntry?.id}
        initialDraft={editingEntry ? toEntryDraft(editingEntry) : EMPTY_ENTRY_DRAFT}
        languages={languages}
        mods={knownMods}
        onClose={() => setEditingEntry(null)}
        onSubmit={handleUpdate}
      />

      <DictionaryReplaceModal
        open={replaceOpen}
        selectedCount={selectedCount}
        onClose={() => setReplaceOpen(false)}
        onSubmit={handleBatchReplace}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={pendingDelete?.title ?? t('dialogs.deleteEntryTitle', { ns: 'dictionary' })}
        description={pendingDelete?.description ?? ''}
        confirmLabel={t('dialogs.deleteConfirm', { ns: 'dictionary' })}
        destructive
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void handleDeleteMany(pendingDelete.ids)
        }}
      />

      <DictionaryImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={async () => {
          await Promise.all([refreshCurrentPage(), loadReferenceData()])
        }}
      />
    </div>
  )
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  className,
  menuMinWidth,
  t
}: {
  label: string
  value: string
  options: ThemedSelectOption[]
  onChange: (value: string) => void
  className?: string
  menuMinWidth?: number
  t: (key: string, options?: Record<string, unknown>) => string
}): React.JSX.Element {
  return (
    <ThemedSelect
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      searchable
      placeholder={t('filters.all', { ns: 'dictionary' })}
      searchPlaceholder={t('placeholders.search', { ns: 'common' })}
      emptyLabel={t('placeholders.noOptionFound', { ns: 'common' })}
      className={className ?? 'w-40'}
      triggerClassName="h-8 bg-[#131518] px-3 text-xs"
      menuClassName="border-[#303641]"
      menuMinWidth={menuMinWidth}
    />
  )
}

function PageSizeSelect({
  value,
  onChange,
  t
}: {
  value: number
  onChange: (value: string) => void
  t: (key: string, options?: Record<string, unknown>) => string
}): React.JSX.Element {
  const options = PAGE_SIZE_OPTIONS.map((option) => ({
    value: String(option),
    label: t('filters.pageSizeOption', { ns: 'dictionary', count: option })
  }))

  return (
    <ThemedSelect
      label={t('filters.pageSize', { ns: 'dictionary' })}
      value={String(value)}
      onChange={onChange}
      options={options}
      className="w-36"
      triggerClassName="h-8 bg-[#131518] px-3 text-xs"
      menuClassName="border-[#303641]"
      menuMinWidth={160}
    />
  )
}

function StatBlock({
  label,
  value,
  detail,
  accentValue = false
}: {
  label: string
  value: string
  detail?: string
  accentValue?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] font-semibold tracking-[0.08em] text-neutral-500 uppercase">
        {label}
      </div>
      <div className="text-lg font-semibold">
        <span className={accentValue ? 'text-amber-400' : 'text-neutral-100'}>{value}</span>
        {detail && <span className="ml-1 text-sm font-normal text-neutral-500">{detail}</span>}
      </div>
    </div>
  )
}

function DictionaryLoadingOverlay({
  mode
}: {
  mode: DictionaryLoadingMode
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0',
        mode === 'replace' ? 'bg-[#0f1114]' : 'bg-[#0f1114]/55 backdrop-blur-[1px]'
      )}
    >
      <div className="flex h-full flex-col gap-3 px-4 py-4">
        <div className="h-10 rounded-md bg-[#1a1d22]/90" />
        {Array.from({ length: 7 }).map((_, index) => (
          <div
            key={`dictionary-loading-row-${index + 1}`}
            className="grid animate-pulse gap-3 rounded-md border border-[#22262d] bg-[#14171b]/90 px-4 py-3"
            style={{ gridTemplateColumns: '40px 80px 1.2fr 1.2fr 180px 120px 80px' }}
          >
            <div className="h-4 rounded bg-[#262b33]" />
            <div className="h-4 rounded bg-[#262b33]" />
            <div className="h-4 rounded bg-[#262b33]" />
            <div className="h-4 rounded bg-[#262b33]" />
            <div className="h-4 rounded bg-[#262b33]" />
            <div className="h-4 rounded bg-[#262b33]" />
            <div className="h-4 rounded bg-[#262b33]" />
          </div>
        ))}
      </div>
    </div>
  )
}

function buildExportName(filters: DictionaryFilters): string {
  const parts = ['dictionary']
  if (filters.sourceLang) parts.push(filters.sourceLang)
  if (filters.targetLang) parts.push(filters.targetLang)
  if (filters.modName) parts.push(filters.modName.replace(/[^a-zA-Z0-9._-]/g, '_'))
  return `${parts.join('_')}.csv`
}

function buildModOptions(entries: DisplayEntry[], knownMods: string[]): FilterOption[] {
  const counts = new Map<string, number>()
  for (const entry of entries) {
    if (!entry.modName) continue
    counts.set(entry.modName, (counts.get(entry.modName) ?? 0) + 1)
  }

  return [...new Set([...knownMods, ...counts.keys()])]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .map((value) => ({
      value,
      label: value,
      count: counts.get(value) ?? 0
    }))
}

function buildLanguageOptions(
  entries: DisplayEntry[],
  side: 'source' | 'target'
): Map<string, number> {
  const counts = new Map<string, number>()

  for (const entry of entries) {
    const code = side === 'source' ? entry.sourceLang : entry.targetLang
    counts.set(code, (counts.get(code) ?? 0) + 1)
  }

  return counts
}

function toDisplayEntry(entry: DictionaryEntry, filters: DictionaryFilters): DisplayEntry {
  const swap = shouldSwap(entry, filters)
  return {
    id: entry.id,
    sourceLang: swap ? entry.language2 : entry.language1,
    targetLang: swap ? entry.language1 : entry.language2,
    sourceText: decodeDictionaryTextForUi(swap ? entry.textLanguage2 : entry.textLanguage1),
    targetText: decodeDictionaryTextForUi(swap ? entry.textLanguage1 : entry.textLanguage2),
    modName: entry.modName ?? '',
    uid: entry.uid ?? '',
    updatedAt: entry.updatedAt
  }
}

function toEntryDraft(entry: DisplayEntry): EntryDraft {
  return {
    sourceLang: entry.sourceLang,
    targetLang: entry.targetLang,
    sourceText: entry.sourceText,
    targetText: entry.targetText,
    modName: entry.modName,
    uid: entry.uid
  }
}

function shouldSwap(entry: DictionaryEntry, filters: DictionaryFilters): boolean {
  if (filters.sourceLang && filters.targetLang) {
    return entry.language1 !== filters.sourceLang
  }

  if (filters.sourceLang) {
    return entry.language2 === filters.sourceLang
  }

  if (filters.targetLang) {
    return entry.language1 === filters.targetLang
  }

  return false
}
