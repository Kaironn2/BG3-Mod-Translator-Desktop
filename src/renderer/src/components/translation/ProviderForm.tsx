import { DragDrop } from '@/components/shared/DragDrop'
import { LanguageSelect } from '@/components/shared/LanguageSelect'
import { useAppTranslation } from '@/i18n/useAppTranslation'

export interface ProviderFields {
  filePath: string
  modName: string
  sourceLang: string
  targetLang: string
  apiKey?: string
  author?: string
  model?: string
}

interface ProviderFormProps {
  provider: 'openai' | 'deepl' | 'manual'
  fields: ProviderFields
  onChange: (patch: Partial<ProviderFields>) => void
  disabled: boolean
}

const MOD_EXTENSIONS = ['zip', 'pak', 'xml']

export function ProviderForm({
  provider,
  fields,
  onChange,
  disabled
}: ProviderFormProps): React.JSX.Element {
  const { t } = useAppTranslation(['common', 'translate'])

  return (
    <div className="flex flex-col gap-4">
      <DragDrop
        accept={MOD_EXTENSIONS}
        onFile={(path) => onChange({ filePath: path })}
        label={t('setup.fileCard.dropPrompt', { ns: 'translate' })}
        className={disabled ? 'pointer-events-none opacity-50' : ''}
      />

      {fields.filePath && (
        <p className="truncate text-xs text-neutral-400" title={fields.filePath}>
          {fields.filePath}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <LanguageSelect
          label={t('fields.sourceLanguage')}
          value={fields.sourceLang}
          onChange={(v) => onChange({ sourceLang: v })}
        />
        <LanguageSelect
          label={t('fields.targetLanguage')}
          value={fields.targetLang}
          onChange={(v) => onChange({ targetLang: v })}
        />
      </div>

      <Field
        label={t('fields.mod')}
        value={fields.modName}
        onChange={(v) => onChange({ modName: v })}
        disabled={disabled}
        placeholder="MyMod"
      />

      <Field
        label={t('fields.author')}
        value={fields.author ?? ''}
        onChange={(v) => onChange({ author: v })}
        disabled={disabled}
        placeholder="Your name"
      />

      {/* {(provider === 'openai' || provider === 'deepl') && (
        <Field
          label={provider === 'openai' ? 'OpenAI API Key' : 'DeepL API Key'}
          value={fields.apiKey ?? ''}
          onChange={(v) => onChange({ apiKey: v })}
          disabled={disabled}
          type="password"
          placeholder="sk-..."
        />
      )} */}

      {provider === 'deepl' && (
        <Field
          label="DeepL API Key"
          value={fields.apiKey ?? ''}
          onChange={(v) => onChange({ apiKey: v })}
          disabled={disabled}
          type="password"
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx"
        />
      )}

      {/* {provider === 'openai' && (
        <Field
          label="Model"
          value={fields.model ?? 'gpt-4o-mini'}
          onChange={(v) => onChange({ model: v })}
          disabled={disabled}
          placeholder="gpt-4o-mini"
        />
      )} */}
    </div>
  )
}

interface FieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  disabled: boolean
  placeholder?: string
  type?: string
}

function Field({ label, value, onChange, disabled, placeholder, type = 'text' }: FieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-neutral-400">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
      />
    </div>
  )
}
