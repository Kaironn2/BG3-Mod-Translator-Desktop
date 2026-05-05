import { Loader2 } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { DragDrop } from '@/components/shared/DragDrop'
import { LanguageSelect } from '@/components/shared/LanguageSelect'
import { BatchActionBar } from '@/components/translation/BatchActionBar'
import { ModSelector } from '@/components/translation/ModSelector'
import { TranslationGrid } from '@/components/translation/TranslationGrid'
import { useTranslationSession } from '@/context/TranslationSession'
import { cn } from '@/lib/utils'

// ----- Inline SVG icons matching the Focus Stack design -----

function SvgIcon({
  children,
  size = 14,
  className,
}: {
  children: React.ReactNode
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  )
}

function IconUndo({ size = 14 }: { size?: number }) {
  return (
    <SvgIcon size={size}>
      <path d="M9 14l-4-4 4-4" />
      <path d="M5 10h9a5 5 0 015 5v1" />
    </SvgIcon>
  )
}
function IconRedo({ size = 14 }: { size?: number }) {
  return (
    <SvgIcon size={size}>
      <path d="M15 14l4-4-4-4" />
      <path d="M19 10h-9a5 5 0 00-5 5v1" />
    </SvgIcon>
  )
}
function IconFocusMode({ size = 14 }: { size?: number }) {
  return (
    <SvgIcon size={size}>
      <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
      <circle cx="12" cy="12" r="3" />
    </SvgIcon>
  )
}
function IconFile({ size = 14 }: { size?: number }) {
  return (
    <SvgIcon size={size}>
      <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" />
      <path d="M14 3v6h6" />
    </SvgIcon>
  )
}
function IconSave({ size = 14 }: { size?: number }) {
  return (
    <SvgIcon size={size}>
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
      <path d="M17 21v-8H7v8M7 3v5h8" />
    </SvgIcon>
  )
}
function IconExport({ size = 14 }: { size?: number }) {
  return (
    <SvgIcon size={size}>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5-5 5 5M12 5v12" />
    </SvgIcon>
  )
}
function IconChevR({ size = 12 }: { size?: number }) {
  return (
    <SvgIcon size={size}>
      <path d="M9 6l6 6-6 6" />
    </SvgIcon>
  )
}
function IconArrow({ size = 20 }: { size?: number }) {
  return (
    <SvgIcon size={size}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </SvgIcon>
  )
}

// Layout toggle SVGs (from design direction-a)
function IconSplitLayout() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <rect x="3" y="4" width="8" height="16" rx="1" />
      <rect x="13" y="4" width="8" height="16" rx="1" />
    </svg>
  )
}
function IconStackLayout() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <rect x="3" y="4" width="18" height="7" rx="1" />
      <rect x="3" y="13" width="18" height="7" rx="1" />
    </svg>
  )
}

// ----- Shared button class helpers -----

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

// ----- Idle phase -----

interface IdlePhaseProps {
  session: ReturnType<typeof useTranslationSession>
}

function IdlePhase({ session }: IdlePhaseProps): React.JSX.Element {
  const handleFile = async (filePath: string) => {
    if (!session.sourceLang || !session.targetLang) {
      toast.error('Selecione os idiomas de origem e destino')
      return
    }
    try {
      await session.loadSession(filePath, session.sourceLang, session.targetLang)
      toast.success('Arquivo carregado!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar arquivo')
    }
  }

  const handleSourceChange = (lang: string) => {
    session.setSourceLang(lang)
    window.api.config.set({ key: 'last_source_lang', value: lang })
  }

  const handleTargetChange = (lang: string) => {
    session.setTargetLang(lang)
    window.api.config.set({ key: 'last_target_lang', value: lang })
  }

  return (
    <div className="flex flex-col h-full items-center justify-center gap-8 p-8">
      {session.phase === 'loading' ? (
        <div className="flex flex-col items-center gap-3 text-neutral-400">
          <Loader2 size={32} className="animate-spin" />
          <p className="text-sm">Processando arquivo...</p>
        </div>
      ) : (
        <>
          <div className="w-full max-w-lg flex flex-col gap-4">
            <div className="flex gap-4">
              <LanguageSelect
                label="Idioma de origem"
                value={session.sourceLang}
                onChange={handleSourceChange}
                className="flex-1"
              />
              <div className="flex items-end pb-2 text-neutral-500">→</div>
              <LanguageSelect
                label="Idioma de destino"
                value={session.targetLang}
                onChange={handleTargetChange}
                className="flex-1"
              />
            </div>

            <ModSelector value={session.modName} onChange={session.setModName} />
          </div>

          <DragDrop
            accept={['xml', 'pak', 'zip']}
            onFile={handleFile}
            label="Arraste o arquivo do mod aqui"
            className="w-full max-w-lg"
          />
        </>
      )}
    </div>
  )
}

// ----- Loaded phase -----

interface LoadedPhaseProps {
  session: ReturnType<typeof useTranslationSession>
}

function LoadedPhase({ session }: LoadedPhaseProps): React.JSX.Element {
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set())
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

  const handleSelectionChange = useCallback((uid: string, selected: boolean) => {
    setSelectedUids((prev) => {
      const next = new Set(prev)
      if (selected) next.add(uid)
      else next.delete(uid)
      return next
    })
  }, [])

  const handleSelectAll = useCallback((uids: string[], selected: boolean) => {
    setSelectedUids((prev) => {
      const next = new Set(prev)
      if (selected) uids.forEach((uid) => next.add(uid))
      else uids.forEach((uid) => next.delete(uid))
      return next
    })
  }, [])

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
          uid: uid || null,
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
        .filter((e) => selectedUids.has(e.uid))
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
          targetLang: session.targetLang,
        })
        toast.success(`${selectedEntries.length} entradas traduzidas`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro na tradução em lote')
      } finally {
        batchUnsubRef.current?.()
        batchUnsubRef.current = null
        setIsBatchTranslating(false)
        setSelectedUids(new Set())
      }
    },
    [session, selectedUids]
  )

  const handleSave = async () => {
    const toSave = session.entries.filter((e) => e.target.trim() !== '')
    if (toSave.length === 0) {
      toast.info('Nenhuma tradução para salvar')
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
          uid: entry.uid || null,
        })
      }
      toast.success(`${toSave.length} traduções salvas no dicionário`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setIsSaving(false)
    }
  }

  const handleExport = async () => {
    const outputPath = await window.api.fs.saveDialog({
      defaultName: `${session.modName || 'traducao'}_${session.targetLang}.xml`,
      filters: [{ name: 'XML', extensions: ['xml'] }],
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
      {/* ── Focus Stack Header ── */}
      <div className="bg-[#0f1114] border-b border-[#1f2329] px-7 pt-5 pb-4 shrink-0">
        {/* Top row: breadcrumbs + actions */}
        <div className="flex items-center gap-3 mb-4">
          {/* Breadcrumbs */}
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

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-1.5 shrink-0">
            {/* Layout segment */}
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
              {isSaving ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <IconSave />
              )}
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
          {/* Language pair + meta */}
          <div className="flex-1 min-w-0">
            <h1 className="flex items-center gap-3.5 m-0 text-[32px] font-bold tracking-tight leading-none mb-2">
              <span className="font-mono text-neutral-200 font-bold">
                {session.sourceLang === 'English' ? 'EN' : session.sourceLang.slice(0, 5).toUpperCase()}
              </span>
              <span className="text-neutral-500 inline-flex">
                <IconArrow />
              </span>
              <span className="font-mono text-amber-400 font-bold">
                {session.targetLang === 'Brazilian Portuguese'
                  ? 'PT-BR'
                  : session.targetLang.slice(0, 5).toUpperCase()}
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
                dicionário aplicáveis
              </span>
            </div>
          </div>

          {/* Progress card */}
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
              {/* Segment tick marks */}
              <div
                className="absolute inset-0 grid"
                style={{ gridTemplateColumns: 'repeat(40, 1fr)' }}
              >
                {Array.from({ length: 40 }, (_, i) => (
                  <div
                    key={i}
                    className={i < 39 ? 'border-r border-[#0f1114]' : ''}
                  />
                ))}
              </div>
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
          selectedUids={selectedUids}
          onSelectionChange={handleSelectionChange}
          onSelectAll={handleSelectAll}
          viewMode={viewMode}
        />
      </div>

      <BatchActionBar
        selectedCount={selectedUids.size}
        onTranslateDeepL={() => handleBatchTranslate('deepl')}
        onTranslateGPT={() => handleBatchTranslate('openai')}
        onClearSelection={() => setSelectedUids(new Set())}
        isTranslating={isBatchTranslating}
      />
    </div>
  )
}
