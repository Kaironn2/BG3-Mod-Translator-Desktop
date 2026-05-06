import { ArrowRight, Check, ChevronDown, ChevronRight, Columns2, Download, File, Focus, Loader2, Redo2, Rows2, Save, Search, Undo2, Upload, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { BatchActionBar } from '@/components/translation/BatchActionBar'
import { TranslationGrid } from '@/components/translation/TranslationGrid'
import { useTranslationSession } from '@/context/TranslationSession'
import { useClickOutside } from '@/hooks/useClickOutside'
import { cn } from '@/lib/utils'
import type { Language, ModInfo } from '@/types'

// ----- Icons -----

const IconUndo = Undo2
const IconRedo = Redo2
const IconFocusMode = Focus
const IconFile = File
const IconSave = Save
const IconExport = Download
const IconChevR = ChevronRight
const IconArrow = ArrowRight
const IconCheck = Check
const IconChevDown = ChevronDown
const IconSearch = Search
const IconUpload = Upload
const IconX = X
const IconSplitLayout = Columns2
const IconStackLayout = Rows2
// ----- Button helpers -----

const btnBase =
  'inline-flex items-center gap-1.5 h-[30px] px-3 rounded-md border border-neutral-700 bg-[#131518] text-neutral-200 text-xs font-medium cursor-pointer transition-all hover:bg-neutral-800 hover:border-neutral-600 active:translate-y-px select-none whitespace-nowrap'
const btnGhostIcon =
  'inline-flex items-center justify-center w-[30px] h-[30px] rounded-md bg-transparent border-0 text-neutral-400 cursor-pointer transition-all hover:bg-neutral-800 hover:text-neutral-200 select-none'
const btnPrimary =
  'inline-flex items-center gap-1.5 h-[30px] px-3 rounded-md border border-amber-500 bg-amber-500 text-neutral-950 text-xs font-semibold cursor-pointer transition-all hover:bg-amber-400 hover:border-amber-400 active:translate-y-px select-none whitespace-nowrap'

// ----- Page -----

export function TranslatePage(): React.JSX.Element {
  const session = useTranslationSession()

  if (session.phase === 'idle' || session.phase === 'loading') {
    return <IdlePhase session={session} />
  }

  return <LoadedPhase session={session} />
}

// ----- Idle phase (Direction A setup) -----

interface IdlePhaseProps {
  session: ReturnType<typeof useTranslationSession>
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}Z`)
  if (Number.isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return 'agora mesmo'
  if (hours < 24) return `ha ${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `ha ${days} dia${days > 1 ? 's' : ''}`
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `ha ${weeks} semana${weeks > 1 ? 's' : ''}`
  const months = Math.floor(days / 30)
  return `ha ${months} mes${months > 1 ? 'es' : ''}`
}

// Searchable language picker dropdown
function LangPicker({
  value,
  onChange,
  languages,
  accent
}: {
  value: string
  onChange: (code: string) => void
  languages: Language[]
  accent?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const selected = languages.find((l) => l.code === value)
  const filtered = languages.filter(
    (l) =>
      l.name.toLowerCase().includes(query.toLowerCase()) ||
      l.code.toLowerCase().includes(query.toLowerCase())
  )

  useClickOutside(
    ref,
    () => {
      setOpen(false)
      setQuery('')
    },
    open
  )

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-2.5 w-full h-9.5 px-3 rounded-md border text-sm cursor-pointer transition-all text-left',
          open
            ? 'border-amber-500 bg-[#0f1114] shadow-[0_0_0_3px_rgba(245,158,11,0.15)]'
            : 'bg-[#0f1114] border-[#1f2329] hover:border-neutral-600',
          accent ? 'text-amber-400' : 'text-neutral-200'
        )}
      >
        <span className="flex-1 font-medium truncate">{selected?.name ?? 'Selecionar'}</span>
        <span
          className={cn(
            'font-mono text-[10px] px-1.5 py-0.5 rounded bg-neutral-900 border border-[#1f2329] shrink-0',
            accent ? 'text-amber-400' : 'text-neutral-500'
          )}
        >
          {(selected?.code ?? '—').toUpperCase()}
        </span>
        <span className={cn('shrink-0', accent ? 'text-amber-500' : 'text-neutral-500')}>
          <IconChevDown />
        </span>
      </button>

      {open && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-[#131518] border border-neutral-600 rounded-lg shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#1f2329] text-neutral-500">
            <IconSearch />
            <input
              className="flex-1 bg-transparent border-0 outline-none text-neutral-200 text-xs placeholder:text-neutral-600"
              placeholder="Buscar idioma..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.map((l) => (
              <button
                key={l.code}
                type="button"
                onClick={() => {
                  onChange(l.code)
                  setOpen(false)
                  setQuery('')
                }}
                className={cn(
                  'flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-xs cursor-pointer transition-all text-left',
                  l.code === value
                    ? 'bg-amber-400/10 text-amber-400'
                    : 'text-neutral-300 hover:bg-neutral-800'
                )}
              >
                <span className="flex-1">{l.name}</span>
                <span className="font-mono text-[10px] text-neutral-500">
                  {l.code.toUpperCase()}
                </span>
                {l.code === value && <IconCheck size={12} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const MODS_PER_PAGE = 6

function IdlePhase({ session }: IdlePhaseProps): React.JSX.Element {
  const [sourceLang, setSourceLangLocal] = useState(session.sourceLang)
  const [targetLang, setTargetLangLocal] = useState(session.targetLang)
  const [selectedMod, setSelectedMod] = useState<string | null>(null)
  const [isNewMod, setIsNewMod] = useState(false)
  const [newModName, setNewModName] = useState('')
  const [filePath, setFilePath] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [mods, setMods] = useState<ModInfo[]>([])
  const [languages, setLanguages] = useState<Language[]>([])
  const [modSearch, setModSearch] = useState('')
  const [modPage, setModPage] = useState(0)

  const filteredMods = mods.filter((m) => m.name.toLowerCase().includes(modSearch.toLowerCase()))
  const totalPages = Math.max(1, Math.ceil(filteredMods.length / MODS_PER_PAGE))
  const clampedPage = Math.min(modPage, totalPages - 1)
  const pagedMods = filteredMods.slice(
    clampedPage * MODS_PER_PAGE,
    (clampedPage + 1) * MODS_PER_PAGE
  )

  const modName = isNewMod ? newModName.trim() : (selectedMod ?? '')
  const step1Done = !!(sourceLang && targetLang && sourceLang !== targetLang)
  const step2Done = !!(isNewMod ? newModName.trim() : selectedMod)
  const step3Done = !!filePath
  const ready = step1Done && step2Done && step3Done
  const isLoading = session.phase === 'loading'

  const srcLang = languages.find((l) => l.code === sourceLang)
  const tgtLang = languages.find((l) => l.code === targetLang)

  useEffect(() => {
    window.api.language.getAll().then(setLanguages)
  }, [])

  useEffect(() => {
    if (sourceLang && targetLang) {
      window.api.mod.getAll({ lang1: sourceLang, lang2: targetLang }).then(setMods)
    }
  }, [sourceLang, targetLang])

  const handleSourceChange = (lang: string) => {
    setSourceLangLocal(lang)
    session.setSourceLang(lang)
    window.api.config.set({ key: 'last_source_lang', value: lang })
  }

  const handleTargetChange = (lang: string) => {
    setTargetLangLocal(lang)
    session.setTargetLang(lang)
    window.api.config.set({ key: 'last_target_lang', value: lang })
  }

  const handleModSelect = (m: ModInfo) => {
    setSelectedMod(m.name)
    if (m.lastFilePath) {
      setFilePath(m.lastFilePath)
      setFileName(m.lastFilePath.split(/[\\/]/).pop() ?? m.lastFilePath)
    }
  }

  const handleModSearchChange = (q: string) => {
    setModSearch(q)
    setModPage(0)
  }

  const handleBrowse = async () => {
    const paths = await window.api.fs.openDialog({
      filters: [{ name: 'Mod Files', extensions: ['xml', 'pak', 'zip'] }]
    })
    if (paths.length > 0) {
      setFilePath(paths[0])
      setFileName(paths[0].split(/[\\/]/).pop() ?? paths[0])
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const p = window.api.fs.getPathForFile(file)
    setFilePath(p)
    setFileName(file.name)
  }

  const handleOpen = async () => {
    if (!ready || isLoading) return
    try {
      if (!filePath) return
      await session.loadSession(filePath, sourceLang, targetLang, modName)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar arquivo')
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Step indicator bar */}
      <div className="flex items-center gap-3 px-5 h-10 border-b border-[#1f2329] bg-[#131518] shrink-0">
        <span className="flex items-center gap-1.5 font-mono text-[12px] text-neutral-200">
          <IconFile size={12} />
          Novo projeto de traducao
        </span>
        <span className="flex-1" />
        <span className="flex items-center gap-2 font-mono text-[11px]">
          <span className={step1Done ? 'text-amber-400' : 'text-neutral-600'}>1 Idiomas</span>
          <span className="text-neutral-700">·</span>
          <span className={step2Done ? 'text-amber-400' : 'text-neutral-600'}>2 Mod</span>
          <span className="text-neutral-700">·</span>
          <span className={step3Done ? 'text-amber-400' : 'text-neutral-600'}>3 Arquivo</span>
        </span>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 pt-7 pb-6 min-h-0">
        <div className="max-w-220 mx-auto flex flex-col gap-3.5">
          {/* Card 01 - Languages */}
          <section className="grid grid-cols-[56px_1fr] bg-[#131518] border border-[#1f2329] rounded-xl overflow-hidden hover:border-neutral-700 transition-colors">
            <div className="bg-[#0f1114] border-r border-[#1f2329] flex items-start justify-center pt-4.5 font-mono text-[11px] font-bold text-neutral-600 tracking-[0.08em]">
              01
            </div>
            <div className="p-5 flex flex-col gap-3.5">
              <div>
                <h3 className="text-[15px] font-semibold text-neutral-200 tracking-tight m-0">
                  Par de idiomas
                </h3>
                <p className="text-xs text-neutral-500 mt-1 m-0">
                  De onde para onde voce quer traduzir.
                </p>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] gap-3.5 items-end">
                <div>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500 mb-1.5">
                    Origem
                  </span>
                  <LangPicker
                    value={sourceLang}
                    onChange={handleSourceChange}
                    languages={languages}
                  />
                </div>
                <div className="pb-2 text-neutral-500">
                  <IconArrow size={18} />
                </div>
                <div>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500 mb-1.5">
                    Destino
                  </span>
                  <LangPicker
                    value={targetLang}
                    onChange={handleTargetChange}
                    languages={languages}
                    accent
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Card 02 - Mod */}
          <section className="grid grid-cols-[56px_1fr] bg-[#131518] border border-[#1f2329] rounded-xl overflow-hidden hover:border-neutral-700 transition-colors">
            <div className="bg-[#0f1114] border-r border-[#1f2329] flex items-start justify-center pt-4.5 font-mono text-[11px] font-bold text-neutral-600 tracking-[0.08em]">
              02
            </div>
            <div className="p-5 flex flex-col gap-3.5">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <h3 className="text-[15px] font-semibold text-neutral-200 tracking-tight m-0">
                    Mod
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1 m-0">
                    Selecione um existente ou crie um novo.
                  </p>
                </div>
                {/* Segment toggle */}
                <div className="flex items-center bg-[#0f1114] border border-[#1f2329] rounded-md p-0.5 gap-0.5 text-xs shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsNewMod(false)}
                    className={cn(
                      'px-3 h-6 rounded text-xs cursor-pointer transition-all',
                      !isNewMod
                        ? 'bg-[#1f2329] text-neutral-200'
                        : 'bg-transparent text-neutral-500 hover:text-neutral-300'
                    )}
                  >
                    Existente
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsNewMod(true)}
                    className={cn(
                      'px-3 h-6 rounded text-xs cursor-pointer transition-all',
                      isNewMod
                        ? 'bg-[#1f2329] text-neutral-200'
                        : 'bg-transparent text-neutral-500 hover:text-neutral-300'
                    )}
                  >
                    + Novo
                  </button>
                </div>
              </div>

              {!isNewMod ? (
                <div className="flex flex-col gap-2">
                  {/* Search bar */}
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none">
                      <IconSearch size={12} />
                    </span>
                    <input
                      className="w-full h-8 pl-8 pr-3 rounded-md border border-[#1f2329] bg-[#0f1114] text-xs text-neutral-200 focus:outline-none focus:border-neutral-600 placeholder:text-neutral-600"
                      placeholder="Buscar mod..."
                      value={modSearch}
                      onChange={(e) => handleModSearchChange(e.target.value)}
                    />
                  </div>

                  {/* Mod list */}
                  <div className="flex flex-col gap-1.5">
                    {filteredMods.length === 0 ? (
                      <p className="text-xs text-neutral-600 py-4 text-center">
                        {mods.length === 0
                          ? 'Nenhum mod encontrado. Crie um novo.'
                          : 'Nenhum resultado para a busca.'}
                      </p>
                    ) : (
                      pagedMods.map((m) => {
                        const pct =
                          m.totalStrings > 0
                            ? Math.min((m.translatedStrings / m.totalStrings) * 100, 100)
                            : 0
                        const rel = formatRelativeDate(m.updatedAt)
                        return (
                          <button
                            key={m.name}
                            type="button"
                            onClick={() => handleModSelect(m)}
                            className={cn(
                              'grid items-center gap-3 px-3.5 py-3 rounded-lg border cursor-pointer transition-all text-left',
                              'grid-cols-[20px_1fr_140px]',
                              selectedMod === m.name
                                ? 'border-amber-500 bg-amber-400/10'
                                : 'bg-[#0f1114] border-[#1f2329] hover:border-neutral-600 hover:bg-neutral-800/40'
                            )}
                          >
                            {/* Radio dot */}
                            <div
                              className={cn(
                                'w-4.5 h-4.5 rounded-full border flex items-center justify-center shrink-0',
                                selectedMod === m.name ? 'border-amber-400' : 'border-neutral-600'
                              )}
                            >
                              {selectedMod === m.name && (
                                <div className="w-2 h-2 rounded-full bg-amber-400" />
                              )}
                            </div>

                            {/* Name + meta */}
                            <div className="min-w-0">
                              <div className="text-[13px] font-semibold text-neutral-200 truncate">
                                {m.name}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 mt-0.5">
                                {m.totalStrings > 0 && <span>{m.totalStrings} strings</span>}
                                {m.totalStrings > 0 && rel && <span>·</span>}
                                {rel && <span>{rel}</span>}
                              </div>
                            </div>

                            {/* Progress */}
                            <div className="flex flex-col gap-1">
                              <div className="h-1 bg-neutral-900 rounded overflow-hidden">
                                <div
                                  className="h-full bg-amber-400 rounded transition-all duration-300"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <div className="font-mono text-[10px] text-neutral-500 text-right tabular-nums">
                                {pct.toFixed(0)}%
                              </div>
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-0.5">
                      <button
                        type="button"
                        disabled={clampedPage === 0}
                        onClick={() => setModPage((p) => Math.max(0, p - 1))}
                        className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        <svg
                          aria-hidden="true"
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M15 18l-6-6 6-6" />
                        </svg>
                        Anterior
                      </button>
                      <span className="font-mono text-[11px] text-neutral-600 tabular-nums">
                        {clampedPage + 1} / {totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={clampedPage >= totalPages - 1}
                        onClick={() => setModPage((p) => Math.min(totalPages - 1, p + 1))}
                        className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                      >
                        Proxima
                        <svg
                          aria-hidden="true"
                          width="11"
                          height="11"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
                    Nome do mod
                  </span>
                  <input
                    className="h-9 px-3 rounded-md border border-[#1f2329] bg-[#0f1114] text-sm text-neutral-200 focus:outline-none focus:border-amber-500 focus:shadow-[0_0_0_3px_rgba(245,158,11,0.15)] placeholder:text-neutral-600"
                    placeholder="ex: Order of the Dracolich"
                    value={newModName}
                    onChange={(e) => setNewModName(e.target.value)}
                  />
                </div>
              )}
            </div>
          </section>

          {/* Card 03 - File */}
          <section className="grid grid-cols-[56px_1fr] bg-[#131518] border border-[#1f2329] rounded-xl overflow-hidden hover:border-neutral-700 transition-colors">
            <div className="bg-[#0f1114] border-r border-[#1f2329] flex items-start justify-center pt-4.5 font-mono text-[11px] font-bold text-neutral-600 tracking-[0.08em]">
              03
            </div>
            <div className="p-5 flex flex-col gap-3.5">
              <div>
                <h3 className="text-[15px] font-semibold text-neutral-200 tracking-tight m-0">
                  Arquivo do mod
                </h3>
                <p className="text-xs text-neutral-500 mt-1 m-0">
                  Solte aqui ou navegue. Aceita .xml, .pak, .zip.
                </p>
              </div>

              <section
                aria-label="Zona de arrastar arquivo"
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={cn(
                  'rounded-xl border transition-all',
                  fileName
                    ? 'p-3.5 border-amber-500 bg-[#0f1114]'
                    : isDragging
                      ? 'p-8 border-dashed border-amber-500 bg-amber-400/5'
                      : 'p-8 border-dashed border-[#2a2f38] bg-[#0f1114]'
                )}
              >
                {!fileName ? (
                  <div className="flex flex-col items-center gap-2.5">
                    <div
                      aria-hidden="true"
                      className={cn(
                        'w-12 h-12 rounded-full border flex items-center justify-center',
                        isDragging
                          ? 'border-amber-400 bg-[#131518] text-amber-400'
                          : 'border-[#1f2329] bg-neutral-900 text-neutral-500'
                      )}
                    >
                      <IconUpload />
                    </div>
                    <div className="text-[13px] font-medium text-neutral-300">
                      Arraste o arquivo do mod aqui
                    </div>
                    <div className="flex gap-1.5">
                      {['.xml', '.pak', '.zip'].map((ext) => (
                        <span
                          key={ext}
                          className="font-mono text-[10px] px-1.5 py-0.5 bg-[#131518] border border-[#1f2329] rounded text-neutral-500"
                        >
                          {ext}
                        </span>
                      ))}
                    </div>
                    <button type="button" onClick={handleBrowse} className={btnBase}>
                      <IconFile size={13} />
                      Procurar arquivo
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-400/10 text-amber-400 flex items-center justify-center shrink-0">
                      <IconFile size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-[13px] font-semibold text-neutral-200 truncate">
                        {fileName}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-amber-400 mt-0.5">
                        <IconCheck size={10} />
                        Arquivo selecionado
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFilePath(null)
                        setFileName(null)
                      }}
                      className={btnGhostIcon}
                    >
                      <IconX size={14} />
                    </button>
                  </div>
                )}
              </section>
            </div>
          </section>
        </div>
      </div>

      {/* CTA footer - fora da area de scroll, sempre visivel */}
      <div className="shrink-0 px-6 py-3 border-t border-[#1f2329]">
        <div className="max-w-220 mx-auto flex items-center gap-2.5 px-4 py-3 bg-[#131518] border border-neutral-700 rounded-xl shadow-xl">
          <div className="flex-1 text-xs text-neutral-400">
            {ready ? (
              <>
                Pronto para iniciar:{' '}
                <strong className="text-neutral-200 font-semibold">
                  {srcLang?.name ?? sourceLang}
                </strong>
                {' → '}
                <strong className="text-neutral-200 font-semibold">
                  {tgtLang?.name ?? targetLang}
                </strong>
              </>
            ) : (
              'Complete os 3 passos para comecar a traduzir'
            )}
          </div>
          <button type="button" className={btnBase} onClick={session.resetSession}>
            Cancelar
          </button>
          <button
            type="button"
            className={cn(btnPrimary, (!ready || isLoading) && 'opacity-40 cursor-not-allowed')}
            disabled={!ready || isLoading}
            onClick={handleOpen}
          >
            {isLoading ? <Loader2 size={13} className="animate-spin" /> : null}
            Abrir editor
            {!isLoading && (
              <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded bg-neutral-950/30 border border-neutral-800 font-mono text-[10px] text-neutral-300">
                ↵
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ----- Loaded phase -----

interface LoadedPhaseProps {
  session: ReturnType<typeof useTranslationSession>
}

function LoadedPhase({ session }: LoadedPhaseProps): React.JSX.Element {
  const [isBatchTranslating, setIsBatchTranslating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [viewMode, setViewMode] = useState<'side' | 'stacked'>('side')
  const [focusMode, setFocusMode] = useState(false)
  const batchUnsubRef = useRef<(() => void) | null>(null)

  const translatedCount = session.entries.filter((e) => e.target.trim() !== '').length
  const dictCount = session.entries.filter(
    (e) => e.matchType === 'uid' || e.matchType === 'text'
  ).length
  const total = session.entries.length
  const untranslatedCount = total - translatedCount
  const pct = total > 0 ? (translatedCount / total) * 100 : 0

  const fileName = session.inputPath
    ? (session.inputPath.split(/[\\/]/).pop() ?? session.modName)
    : session.modName || 'arquivo.xml'


  const handleEntryManualEdit = useCallback(
    (uid: string) => {
      session.markManual(uid)
    },
    [session]
  )

  const handleEntrySave = useCallback(
    async (uid: string, target: string) => {
      if (!target.trim()) return
      const entry = session.entries.find((e) => e.uid === uid)
      if (!entry) return
      try {
        await window.api.dictionary.upsert({
          language1: session.sourceLang,
          language2: session.targetLang,
          textLanguage1: entry.source,
          textLanguage2: target,
          modName: session.modName || null,
          uid: uid || null
        })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao salvar entrada')
      }
    },
    [session]
  )

  const handleBatchTranslate = useCallback(
    async (provider: 'openai' | 'deepl') => {
      const selectedEntries = session.entries
        .filter((e) => session.selectedUids.has(e.uid))
        .map((e) => ({ uid: e.uid, source: e.source }))

      setIsBatchTranslating(true)

      batchUnsubRef.current = window.api.translation.onBatchProgress(({ uid, target, error }) => {
        if (error) {
          if (uid) toast.error(`Erro em #${uid.slice(0, 8)}: ${error}`)
          else toast.error(error)
          return
        }
        if (target) session.updateEntry(uid, target)
      })

      try {
        await window.api.translation.batch({
          entries: selectedEntries,
          provider,
          sourceLang: session.sourceLang,
          targetLang: session.targetLang
        })
        toast.success(`${selectedEntries.length} entradas traduzidas`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro na traducao em lote')
      } finally {
        batchUnsubRef.current?.()
        batchUnsubRef.current = null
        setIsBatchTranslating(false)
        session.clearSelection()
      }
    },
    [session]
  )

  const handleSave = async () => {
    const toSave = session.entries.filter((e) => e.target.trim() !== '')
    if (toSave.length === 0) {
      toast.info('Nenhuma traducao para salvar')
      return
    }
    setIsSaving(true)
    try {
      for (const entry of toSave) {
        await window.api.dictionary.upsert({
          language1: session.sourceLang,
          language2: session.targetLang,
          textLanguage1: entry.source,
          textLanguage2: entry.target,
          modName: session.modName || null,
          uid: entry.uid || null
        })
      }
      toast.success(`${toSave.length} traducoes salvas no dicionario`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setIsSaving(false)
    }
  }

  const handleExport = async () => {
    const outputPath = await window.api.fs.saveDialog({
      defaultName: `${session.modName || 'traducao'}_${session.targetLang}.xml`,
      filters: [{ name: 'XML', extensions: ['xml'] }]
    })
    if (!outputPath) return
    try {
      await window.api.xml.export({ outputPath, entries: session.entries })
      toast.success('XML exportado com sucesso')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao exportar XML')
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ---- Focus Stack Header ---- */}
      <div className="bg-[#0f1114] border-b border-[#1f2329] px-7 pt-5 pb-4 shrink-0">
        {/* Top row: breadcrumbs + actions */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2 text-sm text-neutral-500 min-w-0">
            <input
              value={session.modName}
              onChange={(e) => session.setModName(e.target.value)}
              placeholder="Nome do mod"
              className="bg-transparent text-neutral-300 font-medium text-sm focus:outline-none placeholder:text-neutral-600 min-w-0 max-w-50"
            />
            <span className="text-neutral-700 shrink-0">
              <IconChevR />
            </span>
            <span className="font-mono font-semibold text-neutral-200 shrink-0">{fileName}</span>
          </div>

          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            <div className="flex items-center bg-[#131518] border border-[#1f2329] rounded-md p-0.75 gap-0.5">
              <button
                type="button"
                title="Lado a lado"
                onClick={() => setViewMode('side')}
                className={cn(
                  'w-6.5 h-5.5 flex items-center justify-center rounded border-0 cursor-pointer transition-all',
                  viewMode === 'side'
                    ? 'bg-[#1f2329] text-neutral-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
                    : 'bg-transparent text-neutral-500 hover:text-neutral-200'
                )}
              >
                <IconSplitLayout />
              </button>
              <button
                type="button"
                title="Empilhado"
                onClick={() => setViewMode('stacked')}
                className={cn(
                  'w-6.5 h-5.5 flex items-center justify-center rounded border-0 cursor-pointer transition-all',
                  viewMode === 'stacked'
                    ? 'bg-[#1f2329] text-neutral-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
                    : 'bg-transparent text-neutral-500 hover:text-neutral-200'
                )}
              >
                <IconStackLayout />
              </button>
            </div>

            <button type="button" className={btnGhostIcon} title="Desfazer" disabled>
              <IconUndo />
            </button>
            <button type="button" className={btnGhostIcon} title="Refazer" disabled>
              <IconRedo />
            </button>

            <div className="w-px h-4.5 bg-[#1f2329] mx-1 shrink-0" />

            <button
              type="button"
              onClick={() => setFocusMode((v) => !v)}
              className={cn(focusMode ? btnPrimary : btnBase)}
            >
              <IconFocusMode />
              Modo foco
              <span className="inline-flex items-center justify-center h-4.5 min-w-4.5 px-1 rounded bg-[#1f2329] border border-[#1f2329] border-b-2 font-mono text-[10px] text-neutral-400">
                F
              </span>
            </button>

            <button type="button" className={btnBase} onClick={session.resetSession}>
              <IconFile />
              Novo
            </button>

            <button
              type="button"
              className={cn(btnBase, isSaving && 'opacity-60 cursor-not-allowed')}
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 size={13} className="animate-spin" /> : <IconSave />}
              Salvar
            </button>

            <button type="button" className={btnPrimary} onClick={handleExport}>
              <IconExport />
              Exportar XML
            </button>
          </div>
        </div>

        {/* Mid row: hero title + progress card */}
        <div className="flex items-end gap-8">
          <div className="flex-1 min-w-0">
            <h1 className="flex items-center gap-3.5 m-0 text-[32px] font-bold tracking-tight leading-none mb-2">
              <span className="font-mono text-neutral-200 font-bold">
                {session.sourceLang.toUpperCase()}
              </span>
              <span className="text-neutral-500 inline-flex">
                <IconArrow />
              </span>
              <span className="font-mono text-amber-400 font-bold">
                {session.targetLang.toUpperCase()}
              </span>
            </h1>
            <div className="flex items-center gap-2.5 text-[13px] text-neutral-400">
              <span>
                <strong className="text-neutral-200 font-semibold">{untranslatedCount}</strong>{' '}
                strings restantes
              </span>
              <span className="text-neutral-700">·</span>
              <span>
                <strong className="text-neutral-200 font-semibold">{dictCount}</strong> termos no
                dicionario aplicaveis
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 min-w-70">
            <div className="flex items-baseline gap-1 justify-end font-mono">
              <span className="text-[28px] font-bold text-amber-400 leading-none tracking-tight">
                {translatedCount}
              </span>
              <span className="text-base text-neutral-500">/{total}</span>
            </div>
            <div className="relative h-1.5 bg-[#131518] rounded overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-amber-400 rounded transition-all duration-240"
                style={{ width: `${pct}%` }}
              />
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(90deg, transparent, transparent calc(2.5% - 1px), #0f1114 calc(2.5% - 1px), #0f1114 2.5%)'
                }}
              />
            </div>
            <div className="font-mono text-[11px] text-neutral-500 text-right tabular-nums">
              {pct.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 min-h-0">
        <TranslationGrid
          entries={session.entries}
          onEntryChange={session.updateEntry}
          onEntryManualEdit={handleEntryManualEdit}
          onEntrySave={handleEntrySave}
          viewMode={viewMode}
        />
      </div>

      <BatchActionBar
        selectedCount={session.selectedUids.size}
        onTranslateDeepL={() => handleBatchTranslate('deepl')}
        onTranslateGPT={() => handleBatchTranslate('openai')}
        onClearSelection={session.clearSelection}
        isTranslating={isBatchTranslating}
      />
    </div>
  )
}
