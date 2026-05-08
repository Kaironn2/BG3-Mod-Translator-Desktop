import { useEffect, useState } from 'react'
import { Copy, FolderOpen, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useConfig } from '@/hooks/useConfig'
import type { ConfigKey } from '@/types'

interface SettingFieldProps {
  label: string
  configKey: ConfigKey
  value: string
  onSave: (key: ConfigKey, value: string) => Promise<void>
  type?: string
  placeholder?: string
}

function SettingField({
  label,
  configKey,
  value,
  onSave,
  type = 'text',
  placeholder
}: SettingFieldProps) {
  const [draft, setDraft] = useState(value)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    await onSave(configKey, draft)
    setSaved(true)
    toast.success(`${label} saved`)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-neutral-400">{label}</label>
      <div className="flex gap-2">
        <input
          type={type}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setSaved(false)
          }}
          placeholder={placeholder}
          className="flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 focus:border-neutral-500 focus:outline-none"
        />
        <button
          onClick={handleSave}
          className="rounded-md bg-neutral-800 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-700"
        >
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  )
}

export function SettingsPage(): React.JSX.Element {
  const { config, loading, set } = useConfig()
  const [logPath, setLogPath] = useState('')

  useEffect(() => {
    window.api.log.getPath().then(setLogPath)
  }, [])

  const handleOpenLog = async () => {
    try {
      await window.api.log.open()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao abrir log')
    }
  }

  const handleCopyLogPath = async () => {
    try {
      await navigator.clipboard.writeText(logPath)
      toast.success('Caminho do log copiado')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao copiar caminho')
    }
  }

  const handleClearLog = async () => {
    try {
      await window.api.log.clear()
      toast.success('Log limpo')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao limpar log')
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-neutral-500">Loading...</div>
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold text-neutral-100">Settings</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-neutral-300">API Keys</h2>
        {/* <SettingField
          label="OpenAI API Key"
          configKey="openai_key"
          value={config['openai_key'] ?? ''}
          onSave={set}
          type="password"
          placeholder="sk-..."
        /> */}
        <SettingField
          label="DeepL API Key"
          configKey="deepl_key"
          value={config['deepl_key'] ?? ''}
          onSave={set}
          type="password"
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx"
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-neutral-300">Defaults</h2>
        <SettingField
          label="Default Author"
          configKey="author"
          value={config['author'] ?? ''}
          onSave={set}
          placeholder="Your name"
        />
        <SettingField
          label="Default Source Language"
          configKey="last_source_lang"
          value={config['last_source_lang'] ?? ''}
          onSave={set}
          placeholder="en"
        />
        <SettingField
          label="Default Target Language"
          configKey="last_target_lang"
          value={config['last_target_lang'] ?? ''}
          onSave={set}
          placeholder="pt-BR"
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-neutral-300">Tools</h2>
        <SettingField
          label="Divine.exe path (leave empty for default)"
          configKey="divine_path"
          value={config['divine_path'] ?? ''}
          onSave={set}
          placeholder="C:\path\to\Divine.exe"
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-neutral-300">Debug logs</h2>
        <div className="rounded-md border border-neutral-800 bg-neutral-900/60 p-3">
          <p className="font-mono text-xs text-neutral-400 break-all">{logPath}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleOpenLog}
              className="inline-flex items-center gap-2 rounded-md bg-neutral-800 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700"
            >
              <FolderOpen size={15} />
              Abrir
            </button>
            <button
              type="button"
              onClick={handleCopyLogPath}
              className="inline-flex items-center gap-2 rounded-md bg-neutral-800 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700"
            >
              <Copy size={15} />
              Copiar caminho
            </button>
            <button
              type="button"
              onClick={handleClearLog}
              className="inline-flex items-center gap-2 rounded-md border border-red-900/70 bg-red-950/40 px-3 py-2 text-sm text-red-300 hover:bg-red-950"
            >
              <Trash2 size={15} />
              Limpar
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
