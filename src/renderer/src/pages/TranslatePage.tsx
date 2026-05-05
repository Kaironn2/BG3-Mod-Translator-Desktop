import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/hooks/useTranslation'
import { ProviderForm, type ProviderFields } from '@/components/translation/ProviderForm'
import { TranslationProgress } from '@/components/translation/TranslationProgress'

type Provider = 'openai' | 'deepl' | 'manual'

const TABS: { id: Provider; label: string }[] = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'deepl', label: 'DeepL' },
  { id: 'manual', label: 'Manual' }
]

const EMPTY_FIELDS: ProviderFields = {
  filePath: '',
  modName: '',
  sourceLang: '',
  targetLang: '',
  apiKey: '',
  author: '',
  model: 'gpt-4o-mini'
}

export function TranslatePage(): React.JSX.Element {
  const [provider, setProvider] = useState<Provider>('openai')
  const [fields, setFields] = useState<ProviderFields>(EMPTY_FIELDS)
  const translation = useTranslation()

  const isRunning = translation.status === 'running'

  const handleStart = async () => {
    if (!fields.filePath || !fields.modName || !fields.sourceLang || !fields.targetLang) return
    await translation.start({ provider, ...fields })
  }

  const patch = (p: Partial<ProviderFields>) => setFields((f) => ({ ...f, ...p }))

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold text-neutral-100">Translate</h1>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-neutral-900 p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setProvider(tab.id)}
            disabled={isRunning}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
              provider === tab.id
                ? 'bg-neutral-700 text-white'
                : 'text-neutral-400 hover:text-neutral-200 disabled:opacity-50'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-1 gap-6 overflow-hidden">
        {/* Left - form */}
        <div className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto">
          <ProviderForm provider={provider} fields={fields} onChange={patch} disabled={isRunning} />

          <div className="flex gap-2">
            <button
              onClick={handleStart}
              disabled={
                isRunning ||
                !fields.filePath ||
                !fields.modName ||
                !fields.sourceLang ||
                !fields.targetLang
              }
              className="flex-1 rounded-md bg-blue-600 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {isRunning ? 'Translating...' : 'Start Translation'}
            </button>

            {isRunning && (
              <button
                onClick={translation.cancel}
                className="rounded-md bg-neutral-800 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-700"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Right - progress */}
        <div className="flex-1 overflow-y-auto">
          <TranslationProgress
            current={translation.current}
            total={translation.total}
            rows={translation.rows}
            outputPath={translation.outputPath}
            error={translation.error}
          />
        </div>
      </div>
    </div>
  )
}
