import { Check, Loader2, Package, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { cn } from '@/lib/utils'
import type { PreparedTranslationInput, TranslationXmlCandidate } from '@/types'
import { btnBase, btnGhostIcon, btnPrimary } from './styles'
import { XmlCandidateCard } from './XmlCandidateCard'

type SourceFileType = 'xml' | 'loca'

interface XmlSelectionModalProps {
  prepared: PreparedTranslationInput
  selectionMode?: 'single' | 'multi'
  onCancel: () => Promise<void>
  onSelect: (candidateIds: string[]) => Promise<void>
}

// A mod can ship the same strings as .xml AND .loca; importing both would
// duplicate dictionary entries. Tabs are exclusive: only the ACTIVE tab's
// selection is imported, and each tab keeps its own choice while switching.
export function XmlSelectionModal({
  prepared,
  selectionMode = 'single',
  onCancel,
  onSelect
}: XmlSelectionModalProps): React.JSX.Element {
  const { t } = useAppTranslation(['translate', 'common'])

  const byType = useMemo(() => {
    const groups: Record<SourceFileType, TranslationXmlCandidate[]> = { xml: [], loca: [] }
    for (const candidate of prepared.candidates) {
      groups[candidate.fileType].push(candidate)
    }
    return groups
  }, [prepared.candidates])

  const hasXml = byType.xml.length > 0
  const hasLoca = byType.loca.length > 0
  const hasBothTypes = hasXml && hasLoca

  const [activeType, setActiveType] = useState<SourceFileType>(hasXml || !hasLoca ? 'xml' : 'loca')
  const [selectedByType, setSelectedByType] = useState<Record<SourceFileType, Set<string>>>(() => {
    const defaultType: SourceFileType = hasXml || !hasLoca ? 'xml' : 'loca'
    const firstValid = byType[defaultType].find((candidate) => candidate.valid)
    return {
      xml: defaultType === 'xml' && firstValid ? new Set([firstValid.id]) : new Set<string>(),
      loca: defaultType === 'loca' && firstValid ? new Set([firstValid.id]) : new Set<string>()
    }
  })
  const [loading, setLoading] = useState(false)

  const activeCandidates = byType[activeType]
  const validCandidateIds = activeCandidates
    .filter((candidate) => candidate.valid)
    .map((candidate) => candidate.id)
  const selectedValidIds = validCandidateIds.filter((id) => selectedByType[activeType].has(id))
  const allValidSelected =
    validCandidateIds.length > 0 &&
    validCandidateIds.every((id) => selectedByType[activeType].has(id))

  const selectCandidate = (candidateId: string) => {
    setSelectedByType((prev) => {
      const current = prev[activeType]
      if (selectionMode === 'single') {
        return { ...prev, [activeType]: new Set([candidateId]) }
      }
      const next = new Set(current)
      if (next.has(candidateId)) next.delete(candidateId)
      else next.add(candidateId)
      return { ...prev, [activeType]: next }
    })
  }

  const handleSelect = async () => {
    if (selectedValidIds.length === 0) return
    setLoading(true)
    try {
      await onSelect(selectedValidIds)
    } catch (err) {
      toast.error(getLocalizedErrorMessage(err, t))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-6">
      <div className="w-full max-w-250 max-h-[82vh] flex flex-col rounded-xl border border-neutral-700 bg-[#0f1114] shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 h-12 border-b border-[#1f2329] bg-[#131518] shrink-0">
          <Package size={15} className="text-amber-400" />
          <div className="flex-1 min-w-0">
            <h2 className="m-0 text-sm font-semibold text-neutral-200">
              {t('xmlSelection.title', { ns: 'translate' })}
            </h2>
            <p className="m-0 text-[11px] text-neutral-500">
              {t('xmlSelection.description', { ns: 'translate' })}
            </p>
          </div>
          <button type="button" className={btnGhostIcon} onClick={onCancel}>
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto icosa-scroll p-5">
          {hasBothTypes && (
            <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200">
              {t('xmlSelection.duplicateHint', { ns: 'translate' })}
            </div>
          )}
          {hasBothTypes && (
            <div className="mb-3 flex w-fit items-center gap-1 rounded-md border border-[#1f2329] bg-[#131518] p-0.5">
              {(
                [
                  {
                    key: 'xml' as const,
                    label: t('xmlSelection.tabXml', { ns: 'translate' }),
                    candidates: byType.xml
                  },
                  {
                    key: 'loca' as const,
                    label: t('xmlSelection.tabLoca', { ns: 'translate' }),
                    candidates: byType.loca
                  }
                ] as const
              ).map((tab) => {
                const validCount = tab.candidates.filter((candidate) => candidate.valid).length
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveType(tab.key)}
                    className={cn(
                      'rounded-[5px] px-2.5 py-1 text-[11px] font-medium transition-colors',
                      activeType === tab.key
                        ? 'bg-[#23272d] text-neutral-100'
                        : 'text-neutral-500 hover:text-neutral-300'
                    )}
                  >
                    {tab.label}
                    <span className="ml-1.5 rounded-full bg-[#181b1f] px-1.5 py-0.5 text-[10px] tabular-nums text-neutral-500">
                      {validCount}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
          {selectionMode === 'multi' && (
            <div className="mb-3 flex items-center gap-3">
              <button
                type="button"
                disabled={loading || validCandidateIds.length === 0}
                onClick={() => {
                  if (allValidSelected) {
                    setSelectedByType((prev) => ({ ...prev, [activeType]: new Set<string>() }))
                  } else {
                    setSelectedByType((prev) => ({
                      ...prev,
                      [activeType]: new Set(validCandidateIds)
                    }))
                  }
                }}
                className="flex cursor-pointer items-center gap-2 text-[11px] text-neutral-400 transition-colors hover:text-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors',
                    allValidSelected
                      ? 'border-amber-400 bg-amber-400/20'
                      : 'border-neutral-600 bg-[#0f1114]'
                  )}
                >
                  {allValidSelected && <Check size={11} className="text-amber-400" />}
                </span>
                {t('xmlSelection.selectedCount', {
                  ns: 'translate',
                  count: selectedValidIds.length
                })}
              </button>
            </div>
          )}
          <div className="flex flex-col gap-2.5">
            {activeCandidates.map((candidate, index) => (
              <XmlCandidateCard
                key={candidate.id}
                candidate={candidate}
                index={index}
                selectionMode={selectionMode}
                selected={selectedByType[activeType].has(candidate.id)}
                onSelect={() => selectCandidate(candidate.id)}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-[#1f2329] bg-[#131518]">
          <button type="button" className={btnBase} onClick={onCancel}>
            {t('actions.cancel', { ns: 'common' })}
          </button>
          <button
            type="button"
            className={cn(
              btnPrimary,
              (selectedValidIds.length === 0 || loading) && 'opacity-40 cursor-not-allowed'
            )}
            disabled={selectedValidIds.length === 0 || loading}
            onClick={handleSelect}
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {t(activeType === 'xml' ? 'xmlSelection.useXml' : 'xmlSelection.useLoca', {
              ns: 'translate'
            })}
          </button>
        </div>
      </div>
    </div>
  )
}