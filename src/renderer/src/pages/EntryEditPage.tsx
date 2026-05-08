import { ArrowLeft, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  type TranslationSessionEntry,
  useTranslationSession
} from '@/context/TranslationSession'
import { HighlightedTextarea } from '@/components/shared/HighlightedTextarea'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { renderSource } from '@/utils/renderSource'

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
  const { t } = useAppTranslation(['translate', 'common'])
  const { sourceLang, targetLang, updateEntry, markManual } = session

  const [target, setTarget] = useState(entry.target ?? '')
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
      toast.error(getLocalizedErrorMessage(err, t))
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
    <div className="mx-auto flex h-full max-w-4xl flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex cursor-pointer items-center gap-1.5 text-sm text-neutral-400 transition-colors hover:text-neutral-200"
        >
          <ArrowLeft size={16} />
          {t('actions.back', { ns: 'common' })}
        </button>
        <span className="truncate font-mono text-xs text-neutral-600">{entry.uid}</span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium tracking-wide text-neutral-400 uppercase">
            {t('entryEdit.originalText', { ns: 'translate', language: sourceLang })}
          </span>
          <div className="flex-1 overflow-y-auto rounded-md border border-neutral-700 bg-neutral-900/50 p-4 text-sm leading-relaxed text-neutral-300 whitespace-pre-wrap">
            {entry.source ? (
              renderSource(entry.source)
            ) : (
              <span className="italic text-neutral-600">
                {t('entryEdit.empty', { ns: 'translate' })}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="entry-target"
            className="text-xs font-medium tracking-wide text-neutral-400 uppercase"
          >
            {t('entryEdit.translation', { ns: 'translate', language: targetLang })}
          </label>
          <HighlightedTextarea
            id="entry-target"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            containerClassName="flex-1 min-h-0 rounded-md border-neutral-700 bg-neutral-900 focus-within:border-neutral-500 focus-within:shadow-none"
            overlayClassName="p-4 text-sm leading-relaxed"
            className="flex-1 min-h-0 p-4 text-sm leading-relaxed"
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={() => handleTranslate('deepl')}
          disabled={translating !== null}
          className="flex cursor-pointer items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {translating === 'deepl' && <Loader2 size={14} className="animate-spin" />}
          {t('entryEdit.translateWithDeepL', { ns: 'translate' })}
        </button>
        {/* <button
          type="button"
          onClick={() => handleTranslate('openai')}
          disabled={translating !== null}
          className="flex cursor-pointer items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {translating === 'openai' && <Loader2 size={14} className="animate-spin" />}
          Translate with OpenAI
        </button> */}

        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="cursor-pointer rounded-md bg-neutral-800 px-4 py-2 text-sm text-neutral-300 transition-colors hover:bg-neutral-700"
          >
            {t('actions.cancel', { ns: 'common' })}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="cursor-pointer rounded-md bg-neutral-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-500"
          >
            {t('actions.save', { ns: 'common' })}
          </button>
        </div>
      </div>
    </div>
  )
}
