import { Loader2 } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { DragDrop } from '@/components/shared/DragDrop'
import { LanguageSelect } from '@/components/shared/LanguageSelect'
import { BatchActionBar } from '@/components/translation/BatchActionBar'
import { ModSelector } from '@/components/translation/ModSelector'
import { TranslationGrid } from '@/components/translation/TranslationGrid'
import { useTranslationSession } from '@/context/TranslationSession'

export function TranslatePage(): React.JSX.Element {
  const session = useTranslationSession()
  const navigate = useNavigate()

  if (session.phase === 'idle' || session.phase === 'loading') {
    return <IdlePhase session={session} />
  }

  return <LoadedPhase session={session} navigate={navigate} />
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
  navigate: ReturnType<typeof useNavigate>
}

function LoadedPhase({ session, navigate }: LoadedPhaseProps): React.JSX.Element {
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set())
  const [isBatchTranslating, setIsBatchTranslating] = useState(false)
  const batchUnsubRef = useRef<(() => void) | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleSelectionChange = useCallback((uid: string, selected: boolean) => {
    setSelectedUids((prev) => {
      const next = new Set(prev)
      if (selected) next.add(uid)
      else next.delete(uid)
      return next
    })
  }, [])

  const handleSelectAll = useCallback(
    (all: boolean) => {
      setSelectedUids(all ? new Set(session.entries.map((e) => e.uid)) : new Set())
    },
    [session.entries]
  )

  const handleEntryClick = useCallback(
    (uid: string) => {
      navigate(`/translate/entry/${uid}`)
    },
    [navigate]
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
          targetLang: session.targetLang
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
          uid: entry.uid || null
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

  const matchedCount = session.entries.filter(
    (e) => e.matchType === 'uid' || e.matchType === 'text'
  ).length
  const translatedCount = session.entries.filter((e) => e.target.trim() !== '').length

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-neutral-800 bg-neutral-950 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <span className="text-neutral-200">{session.sourceLang}</span>
          <span>→</span>
          <span className="text-neutral-200">{session.targetLang}</span>
        </div>

        <div className="h-4 w-px bg-neutral-700" />

        <input
          value={session.modName}
          onChange={(e) => session.setModName(e.target.value)}
          placeholder="Nome do mod..."
          className="bg-transparent text-sm text-neutral-400 placeholder:text-neutral-600 focus:outline-none focus:text-neutral-200 w-40"
        />

        <div className="h-4 w-px bg-neutral-700" />

        <span className="text-xs text-neutral-500">
          {translatedCount}/{session.entries.length} traduzidas
          {matchedCount > 0 && (
            <span className="ml-2 text-yellow-600">{matchedCount} do dicionário</span>
          )}
        </span>

        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={session.resetSession}
            className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs text-neutral-400 transition-colors hover:bg-neutral-700"
          >
            Novo arquivo
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 rounded-md bg-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-200 transition-colors hover:bg-neutral-600 disabled:opacity-50"
          >
            {isSaving && <Loader2 size={12} className="animate-spin" />}
            Salvar Tradução
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
          >
            Exportar XML
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 min-h-0">
        <TranslationGrid
          entries={session.entries}
          onEntryChange={session.updateEntry}
          onEntryClick={handleEntryClick}
          selectedUids={selectedUids}
          onSelectionChange={handleSelectionChange}
          onSelectAll={handleSelectAll}
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
