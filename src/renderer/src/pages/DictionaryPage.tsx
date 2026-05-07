import {
  BookOpen,
  Box,
  Check,
  ChevronDown,
  Download,
  FileSpreadsheet,
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
import { useDebouncedFilter } from '@/hooks/useDebouncedFilter'
import { cn } from '@/lib/utils'
import type {
  DictionaryEntry,
  DictionaryFilters,
  DictionaryImportPreview,
  Language
} from '@/types'
import { formatRelativeDate } from '../features/translate/utils/relativeDate'

type FilterMenuKey = 'mod' | 'source' | 'target' | null

interface EntryDraft {
  sourceLang: string
  targetLang: string
  sourceText: string
  targetText: string
  modName: string
  uid: string
}

interface DisplayEntry extends EntryDraft {
  id: number
  updatedAt: string | null
}

interface FilterOption {
  value: string
  label: string
  sub?: string
  count?: number
}

const TABLE_HEADER =
  'text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500 select-none'

const CELL_INPUT =
  'w-full rounded-md border border-amber-500 bg-[#0c0d0f] px-3 py-2 text-sm text-neutral-100 outline-none shadow-[0_0_0_3px_rgba(245,158,11,0.22)]'

const FIELD_SELECT =
  'rounded-md border border-neutral-700 bg-[#0c0d0f] px-3 py-2 text-sm text-neutral-100 outline-none focus:border-amber-500'

const EMPTY_DRAFT: EntryDraft = {
  sourceLang: '',
  targetLang: '',
  sourceText: '',
  targetText: '',
  modName: '',
  uid: ''
}

export function DictionaryPage(): React.JSX.Element {
  const [entries, setEntries] = useState<DictionaryEntry[]>([])
  const [languages, setLanguages] = useState<Language[]>([])
  const [knownMods, setKnownMods] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState('')
  const [modName, setModName] = useState('')
  const [sourceLang, setSourceLang] = useState('')
  const [targetLang, setTargetLang] = useState('')
  const [openMenu, setOpenMenu] = useState<FilterMenuKey>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState<EntryDraft>(EMPTY_DRAFT)
  const [creating, setCreating] = useState(false)
  const [newDraft, setNewDraft] = useState<EntryDraft>(EMPTY_DRAFT)
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const modAnchorRef = useRef<HTMLButtonElement>(null)
  const sourceAnchorRef = useRef<HTMLButtonElement>(null)
  const targetAnchorRef = useRef<HTMLButtonElement>(null)
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

  const loadEntries = useCallback(async (nextFilters: DictionaryFilters) => {
    setLoading(true)
    try {
      const result = await window.api.dictionary.list(nextFilters)
      setEntries(result)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar o dicionario')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadReferenceData = useCallback(async () => {
    try {
      const [languageRows, modRows] = await Promise.all([
        window.api.language.getAll(),
        window.api.mod.getAll()
      ])
      setLanguages(languageRows)
      setKnownMods(modRows.map((row) => row.name))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar referencias')
    }
  }, [])

  useEffect(() => {
    loadReferenceData()
  }, [loadReferenceData])

  useEffect(() => {
    loadEntries(filters)
  }, [filters, loadEntries])

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
    () => entries.map((entry) => toDisplayEntry(entry, filters)),
    [entries, filters]
  )

  const modOptions = useMemo(
    () => buildModOptions(displayEntries, knownMods),
    [displayEntries, knownMods]
  )

  const sourceOptions = useMemo(
    () => buildLanguageOptions(displayEntries, languageNames, 'source'),
    [displayEntries, languageNames]
  )

  const targetOptions = useMemo(
    () => buildLanguageOptions(displayEntries, languageNames, 'target'),
    [displayEntries, languageNames]
  )

  const stats = useMemo(() => {
    const modCount = new Set(displayEntries.map((entry) => entry.modName || '__none__')).size
    const pairCount = new Set(
      displayEntries.map((entry) => `${entry.sourceLang}->${entry.targetLang}`)
    ).size
    const latest = displayEntries.find((entry) => entry.updatedAt)?.updatedAt ?? null
    return {
      total: entries.length,
      filtered: displayEntries.length,
      modCount,
      pairCount,
      latest
    }
  }, [displayEntries, entries.length])

  const hasFilters = Boolean(text || modName || sourceLang || targetLang)

  const languageOptionList = useMemo(
    () =>
      languages.map((language) => ({
        value: language.code,
        label: language.code.toUpperCase(),
        sub: language.name
      })),
    [languages]
  )

  const modMenuOptions = useMemo(
    () =>
      modOptions.map((option) => ({
        value: option.value,
        label: option.label,
        count: option.count
      })),
    [modOptions]
  )

  const sourceMenuOptions = useMemo(
    () =>
      languageOptionList.map((language) => ({
        ...language,
        count: sourceOptions.find((option) => option.value === language.value)?.count ?? 0
      })),
    [languageOptionList, sourceOptions]
  )

  const targetMenuOptions = useMemo(
    () =>
      languageOptionList.map((language) => ({
        ...language,
        count: targetOptions.find((option) => option.value === language.value)?.count ?? 0
      })),
    [languageOptionList, targetOptions]
  )

  const startCreate = () => {
    setCreating(true)
    setEditingId(null)
    setPendingDeleteId(null)
    setNewDraft({
      sourceLang: sourceLang || 'en',
      targetLang: targetLang || 'pt-BR',
      sourceText: '',
      targetText: '',
      modName,
      uid: ''
    })
  }

  const startEdit = (entry: DisplayEntry) => {
    setCreating(false)
    setPendingDeleteId(null)
    setEditingId(entry.id)
    setDraft({
      sourceLang: entry.sourceLang,
      targetLang: entry.targetLang,
      sourceText: entry.sourceText,
      targetText: entry.targetText,
      modName: entry.modName,
      uid: entry.uid
    })
  }

  const resetEditing = () => {
    setEditingId(null)
    setDraft(EMPTY_DRAFT)
  }

  const resetCreate = () => {
    setCreating(false)
    setNewDraft(EMPTY_DRAFT)
  }

  const handleCreate = async () => {
    if (!isDraftValid(newDraft)) {
      toast.error('Preencha origem, destino e os dois idiomas')
      return
    }

    try {
      await window.api.dictionary.create({
        language1: newDraft.sourceLang,
        language2: newDraft.targetLang,
        textLanguage1: newDraft.sourceText,
        textLanguage2: newDraft.targetText,
        modName: newDraft.modName || null,
        uid: newDraft.uid || null
      })
      toast.success('Entrada criada')
      resetCreate()
      await Promise.all([loadEntries(filters), loadReferenceData()])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar entrada')
    }
  }

  const handleUpdate = async (id: number) => {
    if (!isDraftValid(draft)) {
      toast.error('Preencha origem, destino e os dois idiomas')
      return
    }

    try {
      await window.api.dictionary.update({
        id,
        entry: {
          language1: draft.sourceLang,
          language2: draft.targetLang,
          textLanguage1: draft.sourceText,
          textLanguage2: draft.targetText,
          modName: draft.modName || null,
          uid: draft.uid || null
        }
      })
      toast.success('Entrada atualizada')
      resetEditing()
      await Promise.all([loadEntries(filters), loadReferenceData()])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar entrada')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await window.api.dictionary.delete({ id })
      toast.success('Entrada removida')
      setPendingDeleteId(null)
      if (editingId === id) resetEditing()
      await loadEntries(filters)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remover entrada')
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
      toast.success('CSV exportado')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao exportar CSV')
    }
  }

  const selectedModLabel = modMenuOptions.find((option) => option.value === modName)?.label
  const selectedSourceLabel = sourceLang || 'Todas'
  const selectedTargetLabel = targetLang || 'Todas'

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0f1114] text-neutral-100">
      <header className="flex items-center justify-between border-b border-[#1f2329] px-5 py-3">
        <div className="flex min-w-0 items-center gap-4">
          <div className="inline-flex items-center gap-2 rounded-md border border-[#1f2329] bg-[#131518] px-2.5 py-1.5">
            <BookOpen size={14} className="text-amber-400" />
            <span className="text-sm font-semibold text-neutral-200">dictionary</span>
            <span className="font-mono text-[11px] text-neutral-500">.icosa</span>
          </div>
          <div className="hidden items-center gap-3 text-xs text-neutral-400 md:flex">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              {stats.filtered} entradas
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Box size={12} />
              {stats.modCount} mods
            </span>
            <span className="font-mono text-neutral-500">
              Sync {stats.latest ? formatRelativeDate(stats.latest) : 'agora mesmo'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={loading || displayEntries.length === 0}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-neutral-700 bg-[#131518] px-3 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download size={13} />
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-amber-500 bg-amber-500 px-3 text-xs font-semibold text-neutral-950 transition-colors hover:border-amber-400 hover:bg-amber-400"
          >
            <Upload size={13} />
            Importar CSV
          </button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-[#1f2329] bg-[#0f1114] px-4 py-3">
        <div className="flex h-8 min-w-70 flex-1 items-center gap-2 rounded-md border border-[#1f2329] bg-[#131518] px-3 focus-within:border-neutral-600">
          <Search size={14} className="text-neutral-500" />
          <input
            ref={searchInputRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Buscar termo, traducao, mod ou UID..."
            className="min-w-0 flex-1 bg-transparent text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none"
          />
          {text && (
            <button type="button" onClick={() => setText('')} className="text-neutral-500">
              <X size={13} />
            </button>
          )}
          <span className="inline-flex h-5 min-w-6 items-center justify-center rounded border border-[#252a32] bg-[#0f1114] px-1 font-mono text-[10px] text-neutral-500">
            Ctrl F
          </span>
        </div>

        <FilterControl
          label="Mod"
          valueLabel={selectedModLabel ?? 'Todos os mods'}
          value={modName}
          menu={modMenuOptions}
          open={openMenu === 'mod'}
          onOpenChange={(open) => setOpenMenu(open ? 'mod' : null)}
          onSelect={(value) => setModName(value)}
          anchorRef={modAnchorRef}
        />
        <FilterControl
          label="Origem"
          valueLabel={selectedSourceLabel}
          value={sourceLang}
          menu={sourceMenuOptions}
          open={openMenu === 'source'}
          onOpenChange={(open) => setOpenMenu(open ? 'source' : null)}
          onSelect={(value) => setSourceLang(value)}
          anchorRef={sourceAnchorRef}
        />
        <FilterControl
          label="Destino"
          valueLabel={selectedTargetLabel}
          value={targetLang}
          menu={targetMenuOptions}
          open={openMenu === 'target'}
          onOpenChange={(open) => setOpenMenu(open ? 'target' : null)}
          onSelect={(value) => setTargetLang(value)}
          anchorRef={targetAnchorRef}
        />

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setText('')
              setModName('')
              setSourceLang('')
              setTargetLang('')
            }}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-dashed border-[#3a404a] px-3 text-xs text-neutral-400 transition-colors hover:bg-[#131518] hover:text-neutral-200"
          >
            <FilterX size={12} />
            Limpar
          </button>
        )}

        <div className="ml-auto">
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-amber-500 bg-amber-500 px-3 text-xs font-semibold text-neutral-950 transition-colors hover:border-amber-400 hover:bg-amber-400"
          >
            <Plus size={13} />
            Nova entrada
          </button>
        </div>
      </div>

      <div className="flex items-center gap-6 border-b border-[#1f2329] bg-[#131518] px-4 py-3">
        <StatBlock label="Mostrando" value={`${stats.filtered}`} detail={`/ ${stats.total}`} />
        <StatBlock label="Mods" value={`${stats.modCount}`} />
        <StatBlock label="Pares de idiomas" value={`${stats.pairCount}`} />
        <div className="ml-auto text-right">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
            Ultima edicao
          </div>
          <div className="font-mono text-[11px] text-neutral-400">
            {stats.latest ? formatRelativeDate(stats.latest) : 'sem edicoes'}
          </div>
        </div>
      </div>

      <div className="icosa-scroll flex-1 min-h-0 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-[#131518]">
            <tr className="border-b border-[#1f2329]">
              <th className={cn(TABLE_HEADER, 'w-28 px-4 py-3 text-left')}>ID</th>
              <th className={cn(TABLE_HEADER, 'px-4 py-3 text-left')}>Texto origem</th>
              <th className={cn(TABLE_HEADER, 'px-4 py-3 text-left')}>Texto destino</th>
              <th className={cn(TABLE_HEADER, 'w-48 px-4 py-3 text-left')}>Mod</th>
              <th className={cn(TABLE_HEADER, 'w-36 px-4 py-3 text-left')}>Idiomas</th>
              <th className={cn(TABLE_HEADER, 'w-40 px-4 py-3 text-left')}>UID</th>
              <th className={cn(TABLE_HEADER, 'w-32 px-4 py-3 text-right')}>Acoes</th>
            </tr>
          </thead>
          <tbody>
            {creating && (
              <EditableRow
                draft={newDraft}
                languages={languages}
                mods={knownMods}
                highlight="new"
                onChange={setNewDraft}
                onCancel={resetCreate}
                onSave={handleCreate}
              />
            )}

            {displayEntries.map((entry) =>
              editingId === entry.id ? (
                <EditableRow
                  key={entry.id}
                  id={entry.id}
                  draft={draft}
                  languages={languages}
                  mods={knownMods}
                  highlight="editing"
                  onChange={setDraft}
                  onCancel={resetEditing}
                  onSave={() => handleUpdate(entry.id)}
                />
              ) : (
                <tr
                  key={entry.id}
                  className="border-b border-[#1f2329] transition-colors hover:bg-[#131518]"
                >
                  <td className="px-4 py-3 align-top">
                    <span className="font-mono text-[11px] text-neutral-500">
                      DCT-{String(entry.id).padStart(4, '0')}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="font-mono text-sm leading-6 text-neutral-100 whitespace-pre-wrap">
                      {entry.sourceText}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="font-mono text-sm leading-6 text-neutral-200 whitespace-pre-wrap">
                      {entry.targetText}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className="inline-flex max-w-full items-center gap-2 rounded-md border border-[#252a32] bg-[#0c0d0f] px-2 py-1 text-xs text-neutral-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      <span className="truncate">{entry.modName || 'Sem mod'}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-neutral-400">
                      <span>{entry.sourceLang}</span>
                      <span className="text-neutral-600">-&gt;</span>
                      <span className="text-amber-400">{entry.targetLang}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span className="block max-w-36 truncate font-mono text-[11px] text-neutral-500">
                      {entry.uid || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="flex justify-end gap-1">
                      {pendingDeleteId === entry.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteId(null)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#252a32] text-neutral-400 transition-colors hover:bg-[#131518] hover:text-neutral-200"
                          >
                            <X size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(entry.id)}
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-red-500/40 bg-red-500/10 px-2 text-[11px] font-semibold text-red-300 transition-colors hover:bg-red-500/20"
                          >
                            <Trash2 size={12} />
                            Confirmar
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(entry)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-neutral-400 transition-colors hover:border-[#252a32] hover:bg-[#131518] hover:text-neutral-200"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteId(entry.id)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-neutral-400 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            )}

            {!creating && !loading && displayEntries.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-20">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#252a32] bg-[#131518] text-neutral-400">
                      <BookOpen size={20} />
                    </div>
                    <div className="text-sm font-semibold text-neutral-200">
                      Nenhuma entrada encontrada
                    </div>
                    <div className="text-xs text-neutral-500">
                      Ajuste os filtros ou crie uma nova entrada no dicionario.
                    </div>
                  </div>
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-neutral-500">
                  Carregando entradas...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <footer className="flex items-center gap-4 border-t border-[#1f2329] bg-[#0c0d0f] px-4 py-2 text-[11px] text-neutral-500">
        <span className="inline-flex items-center gap-1.5">
          <Wifi size={11} className="text-amber-400" />
          Conectado
        </span>
        <span>UTF-8</span>
        <span>dictionary.icosa</span>
        <span className="flex-1" />
        <span className="font-mono">
          {stats.filtered} de {stats.total} entradas
        </span>
      </footer>

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={async () => {
          await Promise.all([loadEntries(filters), loadReferenceData()])
        }}
      />
    </div>
  )
}

function FilterControl({
  label,
  valueLabel,
  value,
  menu,
  open,
  onOpenChange,
  onSelect,
  anchorRef
}: {
  label: string
  valueLabel: string
  value: string
  menu: FilterOption[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (value: string) => void
  anchorRef: React.RefObject<HTMLButtonElement | null>
}) {
  return (
    <div className="relative">
      <button
        ref={anchorRef}
        type="button"
        onClick={() => onOpenChange(!open)}
        className={cn(
          'inline-flex h-8 items-center gap-2 rounded-md border px-3 text-xs transition-colors',
          open
            ? 'border-amber-500 bg-[#181b1f] text-neutral-100 shadow-[0_0_0_3px_rgba(245,158,11,0.18)]'
            : 'border-[#1f2329] bg-[#131518] text-neutral-200 hover:border-[#303641]'
        )}
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
          {label}
        </span>
        <span className={cn('font-mono', !value && 'text-neutral-400')}>{valueLabel}</span>
        <ChevronDown size={12} className="text-neutral-500" />
      </button>
      <FilterMenu
        open={open}
        value={value}
        options={menu}
        anchorRef={anchorRef}
        onClose={() => onOpenChange(false)}
        onSelect={(nextValue) => {
          onSelect(nextValue)
          onOpenChange(false)
        }}
      />
    </div>
  )
}

function FilterMenu({
  open,
  value,
  options,
  anchorRef,
  onClose,
  onSelect
}: {
  open: boolean
  value: string
  options: FilterOption[]
  anchorRef: React.RefObject<HTMLButtonElement | null>
  onClose: () => void
  onSelect: (value: string) => void
}) {
  const [query, setQuery] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handler = (event: MouseEvent) => {
      const target = event.target as Node
      if (menuRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
    }

    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [anchorRef, onClose, open])

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  if (!open) return null

  const filtered = query
    ? options.filter((option) => {
        const haystack = `${option.label} ${option.sub ?? ''}`.toLowerCase()
        return haystack.includes(query.toLowerCase())
      })
    : options

  return (
    <div
      ref={menuRef}
      className="absolute left-0 top-[calc(100%+6px)] z-20 min-w-60 rounded-lg border border-[#303641] bg-[#131518] p-1 shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
    >
      {options.some((option) => option.sub) && (
        <div className="mb-1 flex items-center gap-2 border-b border-[#1f2329] px-2 py-2 text-neutral-400">
          <Search size={12} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filtrar..."
            className="w-full bg-transparent text-xs text-neutral-200 placeholder:text-neutral-600 focus:outline-none"
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => onSelect('')}
        className={cn(
          'flex h-8 w-full items-center rounded-md px-2 text-left text-xs transition-colors',
          !value ? 'bg-amber-500/12 text-amber-400' : 'text-neutral-200 hover:bg-[#181b1f]'
        )}
      >
        <span>Todos</span>
        {!value && <Check size={12} className="ml-auto" />}
      </button>

      {filtered.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onSelect(option.value)}
          className={cn(
            'flex min-h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs transition-colors',
            value === option.value
              ? 'bg-amber-500/12 text-amber-400'
              : 'text-neutral-200 hover:bg-[#181b1f]'
          )}
        >
          <div className="flex min-w-0 flex-col">
            <span>{option.label}</span>
            {option.sub && <span className="text-[11px] text-neutral-500">{option.sub}</span>}
          </div>
          <span className="ml-auto flex items-center gap-2">
            {typeof option.count === 'number' && (
              <span className="font-mono text-[10px] text-neutral-500">{option.count}</span>
            )}
            {value === option.value && <Check size={12} />}
          </span>
        </button>
      ))}
    </div>
  )
}

function StatBlock({
  label,
  value,
  detail
}: {
  label: string
  value: string
  detail?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
        {label}
      </div>
      <div className="text-lg font-semibold text-neutral-100">
        <span>{value}</span>
        {detail && <span className="ml-1 text-sm font-normal text-neutral-500">{detail}</span>}
      </div>
    </div>
  )
}

function EditableRow({
  id,
  draft,
  languages,
  mods,
  highlight,
  onChange,
  onCancel,
  onSave
}: {
  id?: number
  draft: EntryDraft
  languages: Language[]
  mods: string[]
  highlight: 'new' | 'editing'
  onChange: (draft: EntryDraft) => void
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <tr
      className={cn(
        'border-b border-[#1f2329]',
        highlight === 'new'
          ? 'bg-amber-500/10 shadow-[inset_3px_0_0_#f59e0b]'
          : 'bg-[#131518] shadow-[inset_3px_0_0_#f59e0b]'
      )}
    >
      <td className="px-4 py-3 align-top">
        <span className="font-mono text-[11px] text-neutral-500">
          {id ? `DCT-${String(id).padStart(4, '0')}` : 'nova'}
        </span>
      </td>
      <td className="px-4 py-3 align-top">
        <textarea
          autoFocus
          value={draft.sourceText}
          onChange={(event) => onChange({ ...draft, sourceText: event.target.value })}
          rows={2}
          className={CELL_INPUT}
          placeholder="Texto origem..."
        />
      </td>
      <td className="px-4 py-3 align-top">
        <textarea
          value={draft.targetText}
          onChange={(event) => onChange({ ...draft, targetText: event.target.value })}
          rows={2}
          className={CELL_INPUT}
          placeholder="Texto destino..."
        />
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-col gap-2">
          <input
            list="dictionary-mod-options"
            value={draft.modName}
            onChange={(event) => onChange({ ...draft, modName: event.target.value })}
            className={CELL_INPUT}
            placeholder="Nome do mod"
          />
          <datalist id="dictionary-mod-options">
            {mods.map((modName) => (
              <option key={modName} value={modName} />
            ))}
          </datalist>
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex items-center gap-2">
          <select
            value={draft.sourceLang}
            onChange={(event) => onChange({ ...draft, sourceLang: event.target.value })}
            className={cn(FIELD_SELECT, 'w-24')}
          >
            <option value="">Origem</option>
            {languages.map((language) => (
              <option key={language.code} value={language.code}>
                {language.code}
              </option>
            ))}
          </select>
          <span className="font-mono text-neutral-600">-&gt;</span>
          <select
            value={draft.targetLang}
            onChange={(event) => onChange({ ...draft, targetLang: event.target.value })}
            className={cn(FIELD_SELECT, 'w-24')}
          >
            <option value="">Destino</option>
            {languages.map((language) => (
              <option key={language.code} value={language.code}>
                {language.code}
              </option>
            ))}
          </select>
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <input
          value={draft.uid}
          onChange={(event) => onChange({ ...draft, uid: event.target.value })}
          className={CELL_INPUT}
          placeholder="UID opcional"
        />
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#252a32] text-neutral-400 transition-colors hover:bg-[#181b1f] hover:text-neutral-200"
          >
            <X size={14} />
          </button>
          <button
            type="button"
            onClick={onSave}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-amber-500 bg-amber-500 px-3 text-xs font-semibold text-neutral-950 transition-colors hover:border-amber-400 hover:bg-amber-400"
          >
            <Check size={13} />
            Salvar
          </button>
        </div>
      </td>
    </tr>
  )
}

function ImportModal({
  open,
  onClose,
  onImported
}: {
  open: boolean
  onClose: () => void
  onImported: () => Promise<void>
}) {
  const [filePath, setFilePath] = useState('')
  const [preview, setPreview] = useState<DictionaryImportPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (!open) {
      setFilePath('')
      setPreview(null)
      setLoading(false)
      setImporting(false)
    }
  }, [open])

  if (!open) return null

  const handleSelectFile = async () => {
    const paths = await window.api.fs.openDialog({
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (!paths[0]) return

    setLoading(true)
    try {
      const nextPreview = await window.api.dictionary.previewImport({
        filePath: paths[0],
        format: 'csv'
      })
      setFilePath(paths[0])
      setPreview(nextPreview)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao ler CSV')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!filePath) return
    setImporting(true)
    try {
      const result = await window.api.dictionary.import({ filePath, format: 'csv' })
      toast.success(`${result.count} entradas importadas`)
      await onImported()
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao importar CSV')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-[#303641] bg-[#131518] shadow-[0_20px_60px_rgba(0,0,0,0.45)]">
        <div className="flex items-center gap-3 border-b border-[#1f2329] px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/12 text-amber-400">
            <FileSpreadsheet size={16} />
          </div>
          <div>
            <div className="text-sm font-semibold text-neutral-100">Importar dicionario</div>
            <div className="text-xs text-neutral-500">
              Compatibilidade com `language1/...` e `src/tgt/src_lang/tgt_lang`
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-[#181b1f] hover:text-neutral-200"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-5">
          <button
            type="button"
            onClick={handleSelectFile}
            className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#3a404a] bg-[#0f1114] px-6 py-6 text-center transition-colors hover:border-amber-500 hover:bg-amber-500/6"
          >
            <Upload size={18} className="text-neutral-300" />
            <div className="text-sm font-semibold text-neutral-100">
              {filePath ? filePath.split(/[\\/]/).pop() : 'Escolher arquivo CSV'}
            </div>
            <div className="text-xs text-neutral-500">
              Abra um CSV para visualizar headers detectados e uma previa antes de importar.
            </div>
          </button>

          {loading && <p className="text-sm text-neutral-500">Lendo arquivo...</p>}

          {preview && (
            <>
              <div className="rounded-lg border border-[#1f2329] bg-[#0f1114] p-3 text-xs text-neutral-400">
                <div className="flex flex-wrap items-center gap-3">
                  <span>{preview.totalRows} linhas detectadas</span>
                  <span className="font-mono text-neutral-500">
                    Headers: {preview.headers.join(', ')}
                  </span>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-[#1f2329] bg-[#0f1114]">
                <div className="flex items-center justify-between border-b border-[#1f2329] px-3 py-2 text-[11px] text-neutral-500">
                  <span>Previa das primeiras {preview.rows.length} linhas</span>
                  <span className="font-mono">UTF-8 . CSV</span>
                </div>
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#131518]">
                      <th className="px-3 py-2 text-left font-semibold uppercase tracking-[0.06em] text-neutral-500">
                        Origem
                      </th>
                      <th className="px-3 py-2 text-left font-semibold uppercase tracking-[0.06em] text-neutral-500">
                        Destino
                      </th>
                      <th className="px-3 py-2 text-left font-semibold uppercase tracking-[0.06em] text-neutral-500">
                        Mod
                      </th>
                      <th className="px-3 py-2 text-left font-semibold uppercase tracking-[0.06em] text-neutral-500">
                        Idiomas
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, index) => (
                      <tr key={`${row.uid ?? 'row'}-${index}`} className="border-t border-[#1f2329]">
                        <td className="px-3 py-2 font-mono text-neutral-200">{row.sourceText}</td>
                        <td className="px-3 py-2 font-mono text-neutral-200">{row.targetText}</td>
                        <td className="px-3 py-2 text-neutral-300">{row.modName || 'Sem mod'}</td>
                        <td className="px-3 py-2 font-mono text-neutral-400">
                          {row.sourceLang || '—'} -&gt; {row.targetLang || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#1f2329] bg-[#0f1114] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 items-center rounded-md border border-neutral-700 bg-[#131518] px-3 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!preview || importing}
            onClick={handleImport}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-amber-500 bg-amber-500 px-3 text-xs font-semibold text-neutral-950 transition-colors hover:border-amber-400 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Upload size={13} />
            {importing ? 'Importando...' : `Importar ${preview?.totalRows ?? 0} entradas`}
          </button>
        </div>
      </div>
    </div>
  )
}

function isDraftValid(draft: EntryDraft): boolean {
  return Boolean(
    draft.sourceLang.trim() &&
      draft.targetLang.trim() &&
      draft.sourceText.trim() &&
      draft.targetText.trim()
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
  languageNames: Map<string, string>,
  side: 'source' | 'target'
): FilterOption[] {
  const counts = new Map<string, number>()
  for (const entry of entries) {
    const code = side === 'source' ? entry.sourceLang : entry.targetLang
    counts.set(code, (counts.get(code) ?? 0) + 1)
  }

  return [...counts.keys()].sort((left, right) => left.localeCompare(right)).map((value) => ({
    value,
    label: value.toUpperCase(),
    sub: languageNames.get(value) ?? value,
    count: counts.get(value) ?? 0
  }))
}

function toDisplayEntry(entry: DictionaryEntry, filters: DictionaryFilters): DisplayEntry {
  const swap = shouldSwap(entry, filters)
  return {
    id: entry.id,
    sourceLang: swap ? entry.language2 : entry.language1,
    targetLang: swap ? entry.language1 : entry.language2,
    sourceText: swap ? entry.textLanguage2 : entry.textLanguage1,
    targetText: swap ? entry.textLanguage1 : entry.textLanguage2,
    modName: entry.modName ?? '',
    uid: entry.uid ?? '',
    updatedAt: entry.updatedAt
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
