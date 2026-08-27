import { useSortable } from '@dnd-kit/sortable'
import { ArrowDownToLine, ChevronDown, ChevronUp, GripVertical, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AmberCheckbox } from '@/components/shared/AmberCheckbox'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { ModWithPriority } from '@/types'

interface PriorityModRowProps {
  mod: ModWithPriority
  index: number
  total: number
  selected: boolean
  disabled?: boolean
  onSelectedChange: (checked: boolean) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onSetPosition: (position: number) => void
  onDemote: () => void
  onDelete: () => void
  isSearchActive?: boolean
  dropPreview?: boolean
  ghost?: boolean
}

export function PriorityModRow({
  mod,
  index,
  total,
  selected,
  disabled,
  onSelectedChange,
  onMoveUp,
  onMoveDown,
  onSetPosition,
  onDemote,
  onDelete,
  isSearchActive,
  dropPreview,
  ghost
}: PriorityModRowProps): React.JSX.Element {
  const { t } = useAppTranslation('mods')
  const [draft, setDraft] = useState<string>(String(index + 1))
  const inputRef = useRef<HTMLInputElement>(null)

  const dragDisabled = Boolean(disabled || isSearchActive)
  const { attributes, listeners, setNodeRef } = useSortable({
    id: mod.name,
    disabled: dragDisabled
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraft(e.target.value)
  }

  const commitPosition = () => {
    const parsed = Number.parseInt(draft, 10)
    if (Number.isNaN(parsed)) {
      setDraft(String(index + 1))
      return
    }
    const clamped = Math.max(1, Math.min(total, parsed))
    setDraft(String(clamped))
    onSetPosition(clamped)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitPosition()
      inputRef.current?.blur()
    } else if (e.key === 'Escape') {
      setDraft(String(index + 1))
      inputRef.current?.blur()
    }
  }

  // Keep draft in sync when index changes externally (e.g. after a move)
  const committingRef = useRef(false)
  useEffect(() => {
    if (!committingRef.current) {
      setDraft(String(index + 1))
    }
    committingRef.current = false
  }, [index])

  const isFirst = index === 0
  const isLast = index === total - 1

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      className={`grid grid-cols-[auto_auto_1fr_auto_auto] gap-3 items-center px-4 py-3 hover:bg-[#131518] transition-colors border-b border-[#1f2329] last:border-b-0${ghost ? ' opacity-0' : dropPreview ? ' bg-amber-500/15 ring-1 ring-inset ring-amber-500' : selected ? ' bg-[#131518]' : ''}`}
    >
      <AmberCheckbox
        checked={selected}
        disabled={disabled}
        title={t('actions.select')}
        onChange={onSelectedChange}
      />
      {/* left controls */}
      <div className="flex items-center gap-1">
        <span
          className={`inline-flex shrink-0${dragDisabled ? ' cursor-not-allowed opacity-40' : ' cursor-grab text-neutral-600'}`}
          {...(!dragDisabled ? listeners : undefined)}
        >
          <GripVertical size={16} />
        </span>
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst || disabled}
          title={t('actions.moveUp')}
          className={
            isFirst
              ? 'p-1 rounded text-neutral-700 cursor-not-allowed'
              : 'p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-[#1f2329] transition-colors cursor-pointer'
          }
        >
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast || disabled}
          title={t('actions.moveDown')}
          className={
            isLast
              ? 'p-1 rounded text-neutral-700 cursor-not-allowed'
              : 'p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-[#1f2329] transition-colors cursor-pointer'
          }
        >
          <ChevronDown size={14} />
        </button>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={draft}
          onChange={handleInputChange}
          onBlur={commitPosition}
          onKeyDown={handleKeyDown}
          title={t('actions.positionLabel')}
          className="w-10 text-center text-xs bg-[#0f1114] border border-[#1f2329] rounded px-1 py-0.5 text-neutral-300 focus:outline-none focus:border-amber-500/50"
        />
      </div>

      {/* center - name and string count */}
      <div className="min-w-0">
        <p className="text-sm font-medium text-neutral-200 truncate">{mod.name}</p>
        {mod.totalStrings != null && (
          <p className="text-xs text-neutral-500">{mod.totalStrings.toLocaleString()} entries</p>
        )}
      </div>

      {/* demote button */}
      <button
        type="button"
        onClick={onDemote}
        disabled={disabled}
        title={t('actions.demote')}
        className="text-neutral-400 hover:text-amber-400 hover:bg-amber-500/10 p-1.5 rounded transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ArrowDownToLine size={15} />
      </button>

      {/* delete button */}
      <button
        type="button"
        onClick={onDelete}
        disabled={disabled}
        title={t('actions.delete')}
        className="text-neutral-500 hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Trash2 size={15} />
      </button>
    </div>
  )
}
