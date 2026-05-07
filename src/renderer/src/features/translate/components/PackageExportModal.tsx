import { Download, Loader2, Package, X } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { Language, ModMeta } from '@/types'
import { languageToBg3Folder } from '../utils/exportNames'
import { applyVersion, formatVersion, version64FromText } from '../utils/metaVersion'
import { MetaField } from './MetaField'
import { btnBase, btnGhostIcon, btnPrimary } from './styles'

interface PackageExportModalProps {
  meta: ModMeta
  languages: Language[]
  selectedLanguageFolder: string
  targetLang: string
  isExporting: boolean
  onCancel: () => void
  onSubmit: (meta: ModMeta, languageFolder: string) => Promise<void>
}

export function PackageExportModal({
  meta,
  languages,
  selectedLanguageFolder,
  targetLang,
  isExporting,
  onCancel,
  onSubmit
}: PackageExportModalProps): React.JSX.Element {
  const [draft, setDraft] = useState(meta)
  const [version, setVersion] = useState(formatVersion(meta))
  const [languageFolder, setLanguageFolder] = useState(selectedLanguageFolder)

  const version64 = version64FromText(version)
  const folderValid = /^[a-zA-Z0-9]+$/.test(draft.folder)
  const languageFolderValid = /^[a-zA-Z0-9]+$/.test(languageFolder)
  const canExport = !!version64 && folderValid && languageFolderValid && !isExporting

  const updateDraft = (key: keyof ModMeta, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const handleVersionChange = (value: string) => {
    setVersion(value)
    const updated = applyVersion(draft, value)
    if (updated) setDraft(updated)
  }

  const handleSubmit = async () => {
    const updated = applyVersion(draft, version)
    if (!updated || !canExport) return
    await onSubmit(updated, languageFolder)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-6">
      <div className="w-full max-w-180 rounded-xl border border-neutral-700 bg-[#0f1114] shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 h-12 border-b border-[#1f2329] bg-[#131518]">
          <Package size={15} className="text-amber-400" />
          <div className="flex-1 min-w-0">
            <h2 className="m-0 text-sm font-semibold text-neutral-200">Exportar pacote</h2>
            <p className="m-0 text-[11px] text-neutral-500">
              Folder tambem define a estrutura de pastas e o nome do XML.
            </p>
          </div>
          <button type="button" className={btnGhostIcon} onClick={onCancel}>
            <X size={14} />
          </button>
        </div>

        <div className="p-5 grid grid-cols-2 gap-3.5">
          <MetaField
            label="Name"
            value={draft.name}
            onChange={(value) => updateDraft('name', value)}
          />
          <MetaField
            label="Folder"
            value={draft.folder}
            onChange={(value) => updateDraft('folder', value)}
            invalid={!folderValid}
            hint={!folderValid ? 'Use apenas letras e numeros' : undefined}
          />
          <MetaField
            label="Author"
            value={draft.author}
            onChange={(value) => updateDraft('author', value)}
          />
          <MetaField
            label="UUID"
            value={draft.uuid}
            onChange={(value) => updateDraft('uuid', value)}
          />
          <div className="col-span-2">
            <MetaField
              label="Description"
              value={draft.description}
              onChange={(value) => updateDraft('description', value)}
            />
          </div>
          <MetaField
            label="Versao"
            value={version}
            onChange={handleVersionChange}
            invalid={!version64}
            hint={version64 ? `Version64 ${version64}` : 'Use o formato 1.2.3.4'}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
              Pasta de idioma BG3
            </span>
            <select
              value={languageFolder}
              onChange={(event) => setLanguageFolder(event.target.value)}
              className={cn(
                'h-9 px-3 rounded-md border bg-[#0f1114] text-sm text-neutral-200 focus:outline-none',
                languageFolderValid
                  ? 'border-[#1f2329] focus:border-amber-500'
                  : 'border-red-500 focus:border-red-400'
              )}
            >
              {languages.map((language) => (
                <option key={language.code} value={languageToBg3Folder(language, language.code)}>
                  {languageToBg3Folder(language, language.code)}
                </option>
              ))}
              {!languages.some(
                (language) =>
                  languageToBg3Folder(language, language.code) === selectedLanguageFolder
              ) && (
                <option value={selectedLanguageFolder}>
                  {selectedLanguageFolder || targetLang}
                </option>
              )}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-[#1f2329] bg-[#131518]">
          <button type="button" className={btnBase} onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            className={cn(btnPrimary, !canExport && 'opacity-40 cursor-not-allowed')}
            disabled={!canExport}
            onClick={handleSubmit}
          >
            {isExporting ? <Loader2 size={13} className="animate-spin" /> : <Download />}
            Exportar
          </button>
        </div>
      </div>
    </div>
  )
}
