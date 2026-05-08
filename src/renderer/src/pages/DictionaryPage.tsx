import { BookOpen, Box, Download, FilterX, Pencil, Plus, Search, Trash2, Upload, Wifi, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { DictionaryEntryModal } from '@/components/dictionary/DictionaryEntryModal'
import { DictionaryImportModal } from '@/components/dictionary/DictionaryImportModal'
import { DictionaryReplaceModal } from '@/components/dictionary/DictionaryReplaceModal'
import { applyTextReplace } from '@/components/dictionary/replace'
import {
  EMPTY_ENTRY_DRAFT,
  type DisplayEntry,
  type EntryDraft,
  type ReplaceDraft
} from '@/components/dictionary/types'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { ThemedSelect, type ThemedSelectOption } from '@/components/shared/ThemedSelect'
import { useDebouncedFilter } from '@/hooks/useDebouncedFilter'
import { cn } from '@/lib/utils'
import type { DictionaryEntry, DictionaryFilters, Language } from '@/types'
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

const TABLE_HEADER =
  'select-none text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500'

export function DictionaryPage(): React.JSX.Element {
  const [entries, setEntries] = useState<DictionaryEntry[]>([])
  const [languages, setLanguages] = useState<Language[]>([])
  const [knownMods, setKnownMods] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
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
    () => buildLanguageOptions(displayEntries, 'source'),
    [displayEntries]
  )

  const targetOptions = useMemo(
    () => buildLanguageOptions(displayEntries, 'target'),
    [displayEntries]
  )

  const modSelectOptions = useMemo<ThemedSelectOption[]>(
    () => [
      { value: '', label: 'Todos os mods', badge: `${displayEntries.length}` },
      ...modOptions.map((option) => ({
        value: option.value,
        label: option.label,
        badge: `${option.count ?? 0}`,
        searchText: option.label
      }))
    ],
    [displayEntries.length, modOptions]
  )

  const sourceSelectOptions = useMemo<ThemedSelectOption[]>(
    () => [
      { value: '', label: 'Todos', badge: `${displayEntries.length}` },
      ...languages.map((language) => ({
        value: language.code,
        label: language.code.toUpperCase(),
        badge: `${sourceOptions.get(language.code) ?? 0}`,
        searchText: `${languageNames.get(language.code) ?? language.code} ${language.code}`
      }))
    ],
    [displayEntries.length, languageNames, languages, sourceOptions]
  )

  const targetSelectOptions = useMemo<ThemedSelectOption[]>(
    () => [
      { value: '', label: 'Todos', badge: `${displayEntries.length}` },
      ...languages.map((language) => ({
        value: language.code,
        label: language.code.toUpperCase(),
        badge: `${targetOptions.get(language.code) ?? 0}`,
        searchText: `${languageNames.get(language.code) ?? language.code} ${language.code}`
      }))
    ],
    [displayEntries.length, languageNames, languages, targetOptions]
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

  const allFilteredSelected =
    displayEntries.length > 0 && displayEntries.every((entry) => selectedIds.has(entry.id))
  const hasFilters = Boolean(text || modName || sourceLang || targetLang)
  const selectedCount = selectedIds.size

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
        textLanguage1: draft.sourceText,
        textLanguage2: draft.targetText,
        modName: draft.modName || null,
        uid: draft.uid || null
      })
      toast.success('Entrada criada')
      setCreateOpen(false)
      await Promise.all([loadEntries(filters), loadReferenceData()])
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar entrada')
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
          textLanguage1: draft.sourceText,
          textLanguage2: draft.targetText,
          modName: draft.modName || null,
          uid: draft.uid || null
        }
      })
      toast.success('Entrada atualizada')
      setEditingEntry(null)
      await Promise.all([loadEntries(filters), loadReferenceData()])
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar entrada')
      return false
    }
  }

  const handleDeleteMany = async (ids: number[]) => {
    try {
      for (const id of ids) {
        await window.api.dictionary.delete({ id })
      }
      toast.success(ids.length === 1 ? 'Entrada removida' : `${ids.length} entradas removidas`)
      setPendingDelete(null)
      setSelectedIds((previous) => {
        const next = new Set(previous)
        for (const id of ids) next.delete(id)
        return next
      })
      await loadEntries(filters)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remover entradas')
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
            textLanguage1: nextSource,
            textLanguage2: nextTarget,
            modName: entry.modName || null,
            uid: entry.uid || null
          }
        }
      })
      .filter((update): update is NonNullable<typeof update> => update !== null)

    if (updates.length === 0) {
      toast.info('Nenhuma ocorrencia encontrada nas entradas selecionadas')
      return false
    }

    try {
      for (const update of updates) {
        await window.api.dictionary.update(update)
      }
      toast.success(`Replace aplicado em ${updates.length} entradas`)
      setReplaceOpen(false)
      await Promise.all([loadEntries(filters), loadReferenceData()])
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao aplicar replace em lote')
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
      toast.success('CSV exportado')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao exportar CSV')
    }
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
    setSelectedIds((previous) => {
      const next = new Set(previous)
      for (const entry of displayEntries) {
        if (checked) next.add(entry.id)
        else next.delete(entry.id)
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
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-neutral-700 bg-[#131518] px-3 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download size={13} />
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-amber-500 bg-amber-500 px-3 text-xs font-semibold text-neutral-950 transition-colors hover:border-amber-400 hover:bg-amber-400"
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
            <button
              type="button"
              onClick={() => setText('')}
              className="cursor-pointer text-neutral-500"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <FilterSelect label="Mod" value={modName} options={modSelectOptions} onChange={setModName} />
        <FilterSelect
          label="Idioma 1"
          value={sourceLang}
          options={sourceSelectOptions}
          onChange={setSourceLang}
        />
        <FilterSelect
          label="Idioma 2"
          value={targetLang}
          options={targetSelectOptions}
          onChange={setTargetLang}
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
            className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-dashed border-[#3a404a] px-3 text-xs text-neutral-400 transition-colors hover:bg-[#131518] hover:text-neutral-200"
          >
            <FilterX size={12} />
            Limpar
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] font-medium text-neutral-500">
            {selectedCount > 0 ? `${selectedCount} selecionadas` : 'Nenhuma selecao'}
          </span>
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={() =>
              setPendingDelete({
                ids: Array.from(selectedIds),
                title: 'Excluir selecao?',
                description: `${selectedCount} entradas selecionadas serao removidas do dicionario.`
              })
            }
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-red-500/30 bg-red-500/8 px-3 text-xs font-medium text-red-200 transition-colors hover:bg-red-500/14 disabled:cursor-not-allowed disabled:border-[#252a32] disabled:bg-[#131518] disabled:text-neutral-500"
          >
            <Trash2 size={13} />
            Excluir
          </button>
          <button
            type="button"
            disabled={selectedCount === 0}
            onClick={() => setReplaceOpen(true)}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-neutral-700 bg-[#131518] px-3 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Replace
          </button>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-amber-500 bg-amber-500 px-3 text-xs font-semibold text-neutral-950 transition-colors hover:border-amber-400 hover:bg-amber-400"
          >
            <Plus size={13} />
            Nova entrada
          </button>
        </div>
      </div>

      <div className="flex items-center gap-6 border-b border-[#1f2329] bg-[#131518] px-4 py-3">
        <StatBlock label="Mostrando" value={`${stats.filtered}`} detail={`/ ${stats.total}`} accentValue />
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
              <th className={cn(TABLE_HEADER, 'w-12 px-4 py-3 text-center')}>
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={(event) => toggleSelectAll(event.target.checked)}
                  className="h-4 w-4 cursor-pointer accent-amber-500"
                />
              </th>
              <th className={cn(TABLE_HEADER, 'w-28 px-4 py-3 text-left')}>ID</th>
              <th className={cn(TABLE_HEADER, 'px-4 py-3 text-left')}>Texto idioma 1</th>
              <th className={cn(TABLE_HEADER, 'px-4 py-3 text-left')}>Texto idioma 2</th>
              <th className={cn(TABLE_HEADER, 'w-48 px-4 py-3 text-left')}>Mod</th>
              <th className={cn(TABLE_HEADER, 'w-36 px-4 py-3 text-left')}>Idiomas</th>
              <th className={cn(TABLE_HEADER, 'w-32 px-4 py-3 text-right')}>Acoes</th>
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
                  <div className="whitespace-pre-wrap font-mono text-sm leading-6 text-neutral-100">
                    {entry.sourceText}
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="whitespace-pre-wrap font-mono text-sm leading-6 text-neutral-200">
                    {entry.targetText}
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex flex-col gap-2">
                    <span className="inline-flex max-w-full items-center gap-2 rounded-md border border-[#252a32] bg-[#0c0d0f] px-2 py-1 text-xs text-neutral-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                      <span className="truncate">{entry.modName || 'Sem mod'}</span>
                    </span>
                    {entry.uid && (
                      <span className="truncate font-mono text-[11px] text-neutral-600">
                        UID {entry.uid}
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
                          title: 'Excluir entrada?',
                          description: `A entrada #${entry.id} sera removida do dicionario.`
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
        title={pendingDelete?.title ?? 'Excluir entrada?'}
        description={pendingDelete?.description ?? ''}
        confirmLabel="Excluir"
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
          await Promise.all([loadEntries(filters), loadReferenceData()])
        }}
      />
    </div>
  )
}

function FilterSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: string
  options: ThemedSelectOption[]
  onChange: (value: string) => void
}): React.JSX.Element {
  return (
    <ThemedSelect
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      searchable
      placeholder="Todos"
      searchPlaceholder="Filtrar..."
      emptyLabel="Nenhuma opcao encontrada."
      className="w-36"
      triggerClassName="h-8 bg-[#131518] px-3 text-xs"
      menuClassName="border-[#303641]"
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
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
        {label}
      </div>
      <div className="text-lg font-semibold">
        <span className={accentValue ? 'text-amber-400' : 'text-neutral-100'}>{value}</span>
        {detail && <span className="ml-1 text-sm font-normal text-neutral-500">{detail}</span>}
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
    sourceText: swap ? entry.textLanguage2 : entry.textLanguage1,
    targetText: swap ? entry.textLanguage1 : entry.textLanguage2,
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
