import { Download, Loader2, Package, X } from 'lucide-react'
import { useState } from 'react'
import { ThemedSelect } from '@/components/shared/ThemedSelect'
import { useAppTranslation } from '@/i18n/useAppTranslation'
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
  isExporting: boolean
  onCancel: () => void
  onSubmit: (meta: ModMeta, languageFolder: string) => Promise<void>
}

export function PackageExportModal({
  meta,
  languages,
  selectedLanguageFolder,
  isExporting,
  onCancel,
  onSubmit
}: PackageExportModalProps): React.JSX.Element {
  const { t } = useAppTranslation(['package', 'common'])
  const [draft, setDraft] = useState(meta)
  const [version, setVersion] = useState(formatVersion(meta))
  const [languageFolder, setLanguageFolder] = useState(selectedLanguageFolder)

  const version64 = version64FromText(version)
  const folderValid = /^[a-zA-Z0-9_-]+$/.test(draft.folder)
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
            <h2 className="m-0 text-sm font-semibold text-neutral-200">{t('exportModal.title')}</h2>
            <p className="m-0 text-[11px] text-neutral-500">
              {t('exportModal.description')}
            </p>
          </div>
          <button type="button" className={btnGhostIcon} onClick={onCancel}>
            <X size={14} />
          </button>
        </div>

        <div className="p-5 grid grid-cols-2 gap-3.5">
          <MetaField label={t('fields.name', { ns: 'common' })} value={draft.name} onChange={(value) => updateDraft('name', value)} />
          <MetaField
            label={t('fields.folder', { ns: 'common' })}
            value={draft.folder}
            onChange={(value) => updateDraft('folder', value)}
            invalid={!folderValid}
            hint={!folderValid ? t('exportModal.folderHint') : undefined}
          />
          <MetaField
            label={t('fields.author', { ns: 'common' })}
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
              label={t('fields.description', { ns: 'common' })}
              value={draft.description}
              onChange={(value) => updateDraft('description', value)}
            />
          </div>
          <MetaField
            label={t('fields.version', { ns: 'common' })}
            value={version}
            onChange={handleVersionChange}
            invalid={!version64}
            hint={
              version64
                ? t('exportModal.version64', { value: version64 })
                : t('exportModal.versionHint')
            }
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
              {t('exportModal.bg3LanguageFolder')}
            </span>
            <ThemedSelect
              value={languageFolder}
              onChange={setLanguageFolder}
              className={cn(
                'w-full',
                languageFolderValid
                  ? ''
                  : '[&_button]:border-red-500 [&_button]:focus:border-red-400'
              )}
              options={[
                ...languages.map((language) => ({
                  value: languageToBg3Folder(language, language.code),
                  label: languageToBg3Folder(language, language.code),
                  searchText: `${language.name} ${language.code}`
                })),
                ...(!languages.some(
                  (language) =>
                    languageToBg3Folder(language, language.code) === selectedLanguageFolder
                ) && selectedLanguageFolder
                  ? [{ value: selectedLanguageFolder, label: selectedLanguageFolder }]
                  : [])
              ]}
              searchable
              searchPlaceholder={t('exportModal.searchLanguageFolder')}
              emptyLabel={t('exportModal.noLanguageFolderFound')}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-[#1f2329] bg-[#131518]">
          <button type="button" className={btnBase} onClick={onCancel}>
            {t('actions.cancel', { ns: 'common' })}
          </button>
          <button
            type="button"
            className={cn(btnPrimary, !canExport && 'opacity-40 cursor-not-allowed')}
            disabled={!canExport}
            onClick={handleSubmit}
          >
            {isExporting ? <Loader2 size={13} className="animate-spin" /> : <Download />}
            {t('actions.export', { ns: 'common' })}
          </button>
        </div>
      </div>
    </div>
  )
}
