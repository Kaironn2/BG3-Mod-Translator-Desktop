import { ArrowLeft, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  type TranslationSessionEntry,
  useTranslationSession
} from '@/context/TranslationSession'

export function EntryEditPage(): React.JSX.Element {
  const { uid } = useParams<{ uid: string }>()
  const session = useTranslationSession()

  const entry = session.entries.find((e) => e.rowId === uid)

  if (!entry) return <Navigate to="/translate" replace />

  return <EntryEditor entry={entry} session={session} />
}

function EntryEditor({
  entry,
  session
}: {
  entry: TranslationSessionEntry
  session: ReturnType<typeof useTranslationSession>
}): React.JSX.Element {
  const navigate = useNavigate()
  const { sourceLang, targetLang, updateEntry, markManual } = session

  const [target, setTarget] = useState(entry?.target ?? '')
  const [translating, setTranslating] = useState<'deepl' | 'openai' | null>(null)

  const handleTranslate = async (provider: 'deepl' | 'openai') => {
    setTranslating(provider)
    try {
      const result = await window.api.translation.single({
        provider,
        text: entry.source,
        sourceLang,
        targetLang
      })
      setTarget(result)
      updateEntry(entry.rowId, result)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao traduzir')
    } finally {
      setTranslating(null)
    }
  }

  const handleSave = () => {
    updateEntry(entry.rowId, target)
    markManual(entry.rowId)
    navigate(-1)
  }

  return (
    <div className="flex flex-col h-full p-6 gap-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
        >
          <ArrowLeft size={16} />
          Voltar
        </button>
        <span className="text-xs text-neutral-600 font-mono truncate">{entry.uid}</span>
      </div>

      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
        {/* Source */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-neutral-400 uppercase tracking-wide">
            Texto original ({sourceLang})
          </span>
          <div className="flex-1 rounded-md border border-neutral-700 bg-neutral-900/50 p-4 text-sm text-neutral-300 leading-relaxed overflow-y-auto whitespace-pre-wrap">
            {entry.source || <span className="text-neutral-600 italic">vazio</span>}
          </div>
        </div>

        {/* Target */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="entry-target"
            className="text-xs font-medium text-neutral-400 uppercase tracking-wide"
          >
            Tradução ({targetLang})
          </label>
          <textarea
            id="entry-target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="flex-1 min-h-0 resize-none rounded-md border border-neutral-700 bg-neutral-900 p-4 text-sm text-neutral-200 leading-relaxed focus:border-neutral-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={() => handleTranslate('deepl')}
          disabled={translating !== null}
          className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {translating === 'deepl' && <Loader2 size={14} className="animate-spin" />}
          Traduzir com DeepL
        </button>
        <button
          type="button"
          onClick={() => handleTranslate('openai')}
          disabled={translating !== null}
          className="flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
        >
          {translating === 'openai' && <Loader2 size={14} className="animate-spin" />}
          Traduzir com OpenAI
        </button>

        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-md bg-neutral-800 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-md bg-neutral-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-500"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
