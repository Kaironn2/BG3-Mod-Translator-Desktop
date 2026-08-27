import { useSortable } from '@dnd-kit/sortable'
import { ArrowUpToLine, GripVertical, Trash2 } from 'lucide-react'
import { AmberCheckbox } from '@/components/shared/AmberCheckbox'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { ModWithPriority } from '@/types'

interface FallbackModRowProps {
  mod: ModWithPriority
  selected: boolean
  disabled?: boolean
  onSelectedChange: (checked: boolean) => void
  onPromote: () => void
  onDelete: () => void
  isSearchActive?: boolean
  dropPreview?: boolean
  ghost?: boolean
}

export function FallbackModRow({
  mod,
  selected,
  disabled,
  onSelectedChange,
  onPromote,
  onDelete,
  isSearchActive,
  dropPreview,
  ghost
}: FallbackModRowProps): React.JSX.Element {
  const { t } = useAppTranslation('mods')
  const initial = mod.name.charAt(0).toUpperCase()
  const dragDisabled = Boolean(disabled || isSearchActive)
  const { attributes, listeners, setNodeRef } = useSortable({
    id: mod.name,
    disabled: dragDisabled
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      className={`grid grid-cols-[auto_auto_auto_1fr_auto_auto] gap-3 items-center px-4 py-3 hover:bg-[#131518] transition-colors border-b border-[#1f2329] last:border-b-0${ghost ? ' opacity-0' : dropPreview ? ' bg-amber-500/15 ring-1 ring-inset ring-amber-500' : selected ? ' bg-[#131518]' : ''}`}
    >
      <AmberCheckbox
        checked={selected}
        disabled={disabled}
        title={t('actions.select')}
        onChange={onSelectedChange}
      />
      <span
        className={`inline-flex shrink-0${dragDisabled ? ' cursor-not-allowed opacity-40' : ' cursor-grab text-neutral-600'}`}
        {...(!dragDisabled ? listeners : undefined)}
      >
        <GripVertical size={16} />
      </span>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#1f2329] text-xs font-medium text-neutral-400">
        {initial}
      </span>

      {/* center - name and string count */}
      <div className="min-w-0">
        <p className="text-sm font-medium text-neutral-200 truncate">{mod.name}</p>
        {mod.totalStrings != null && (
          <p className="text-xs text-neutral-500">{mod.totalStrings.toLocaleString()} entries</p>
        )}
      </div>

      {/* promote button */}
      <button
        type="button"
        onClick={onPromote}
        disabled={disabled}
        title={t('actions.promote')}
        className="text-neutral-400 hover:text-amber-400 hover:bg-amber-500/10 p-1.5 rounded transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ArrowUpToLine size={15} />
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
