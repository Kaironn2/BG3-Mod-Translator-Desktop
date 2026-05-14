import { Check, Loader2, Package, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import { cn } from '@/lib/utils'
import type { PreparedTranslationInput } from '@/types'
import { btnBase, btnGhostIcon, btnPrimary } from './styles'
import { XmlCandidateCard } from './XmlCandidateCard'

interface XmlSelectionModalProps {
  prepared: PreparedTranslationInput
  selectionMode?: 'single' | 'multi'
  onCancel: () => Promise<void>
  onSelect: (candidateIds: string[]) => Promise<void>
}

export function XmlSelectionModal({
  prepared,
  selectionMode = 'single',
  onCancel,
  onSelect
}: XmlSelectionModalProps): React.JSX.Element {
  const { t } = useAppTranslation(['translate', 'common'])
  const firstValidId = prepared.candidates.find((candidate) => candidate.valid)?.id ?? ''
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(firstValidId ? [firstValidId] : [])
  )
  const [loading, setLoading] = useState(false)
  const validCandidateIds = prepared.candidates
    .filter((candidate) => candidate.valid)
    .map((candidate) => candidate.id)
  const selectedValidIds = validCandidateIds.filter((id) => selectedIds.has(id))
  const allValidSelected =
    validCandidateIds.length > 0 && validCandidateIds.every((id) => selectedIds.has(id))

  const selectCandidate = (candidateId: string) => {
    if (selectionMode === 'single') {
      setSelectedIds(new Set([candidateId]))
      return
    }

    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(candidateId)) next.delete(candidateId)
      else next.add(candidateId)
      return next
    })
  }

  const selectAllValid = () => {
    setSelectedIds(new Set(validCandidateIds))
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
          {selectionMode === 'multi' && (
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="font-mono text-[11px] text-neutral-500">
                {t('xmlSelection.selectedCount', {
                  ns: 'translate',
                  count: selectedValidIds.length
                })}
              </span>
              <button
                type="button"
                className={cn(
                  btnBase,
                  (allValidSelected || loading || validCandidateIds.length === 0) &&
                    'opacity-40 cursor-not-allowed'
                )}
                disabled={allValidSelected || loading || validCandidateIds.length === 0}
                onClick={selectAllValid}
              >
                {t('xmlSelection.selectAll', { ns: 'translate' })}
              </button>
            </div>
          )}
          <div className="flex flex-col gap-2.5">
            {prepared.candidates.map((candidate, index) => (
              <XmlCandidateCard
                key={candidate.id}
                candidate={candidate}
                index={index}
                selectionMode={selectionMode}
                selected={selectedIds.has(candidate.id)}
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
            {t('xmlSelection.useXml', { ns: 'translate' })}
          </button>
        </div>
      </div>
    </div>
  )
}
