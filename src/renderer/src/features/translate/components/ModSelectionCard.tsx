import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ModInfo } from '@/types'
import { formatRelativeDate } from '../utils/relativeDate'

interface ModSelectionCardProps {
  isNewMod: boolean
  selectedMod: string | null
  newModName: string
  mods: ModInfo[]
  filteredMods: ModInfo[]
  pagedMods: ModInfo[]
  modSearch: string
  clampedPage: number
  totalPages: number
  onExistingMode: () => void
  onNewMode: () => void
  onNewModNameChange: (value: string) => void
  onModSearchChange: (value: string) => void
  onModSelect: (mod: ModInfo) => void
  onPageChange: (updater: (page: number) => number) => void
}

export function ModSelectionCard({
  isNewMod,
  selectedMod,
  newModName,
  mods,
  filteredMods,
  pagedMods,
  modSearch,
  clampedPage,
  totalPages,
  onExistingMode,
  onNewMode,
  onNewModNameChange,
  onModSearchChange,
  onModSelect,
  onPageChange
}: ModSelectionCardProps): React.JSX.Element {
  const shouldHighlightNewMode = mods.length === 0 && isNewMod

  return (
    <>
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h3 className="text-[15px] font-semibold text-neutral-200 tracking-tight m-0">Mod</h3>
          <p className="text-xs text-neutral-500 mt-1 m-0">
            Selecione um existente ou crie um novo.
          </p>
        </div>
        <div className="flex items-center bg-[#0f1114] border border-[#1f2329] rounded-md p-0.5 gap-0.5 text-xs shrink-0">
          <button
            type="button"
            onClick={onExistingMode}
            className={cn(
              'px-3 h-6 rounded text-xs cursor-pointer transition-all',
              !isNewMod
                ? 'bg-[#1f2329] text-neutral-200'
                : 'bg-transparent text-neutral-500 hover:text-neutral-300'
            )}
          >
            Existente
          </button>
          <button
            type="button"
            onClick={onNewMode}
            className={cn(
              'px-3 h-6 rounded text-xs cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40',
              isNewMod
                ? 'bg-[#1f2329] text-neutral-200'
                : 'bg-transparent text-neutral-500 hover:text-neutral-300',
              shouldHighlightNewMode && 'ring-2 ring-amber-500/40'
            )}
          >
            + Novo
          </button>
        </div>
      </div>

      {!isNewMod ? (
        <div className="flex flex-col gap-2">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none">
              <Search size={12} />
            </span>
            <input
              className="w-full h-8 pl-8 pr-3 rounded-md border border-[#1f2329] bg-[#0f1114] text-xs text-neutral-200 focus:outline-none focus:border-neutral-600 placeholder:text-neutral-600"
              placeholder="Buscar mod..."
              value={modSearch}
              onChange={(event) => onModSearchChange(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            {filteredMods.length === 0 ? (
              <p className="text-xs text-neutral-600 py-4 text-center">
                {mods.length === 0
                  ? 'Nenhum mod encontrado. Crie um novo.'
                  : 'Nenhum resultado para a busca.'}
              </p>
            ) : (
              pagedMods.map((mod) => (
                <ModOption
                  key={mod.name}
                  mod={mod}
                  selected={selectedMod === mod.name}
                  onSelect={() => onModSelect(mod)}
                />
              ))
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-0.5">
              <button
                type="button"
                disabled={clampedPage === 0}
                onClick={() => onPageChange((page) => Math.max(0, page - 1))}
                className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Anterior
              </button>
              <span className="font-mono text-[11px] text-neutral-600 tabular-nums">
                {clampedPage + 1} / {totalPages}
              </span>
              <button
                type="button"
                disabled={clampedPage >= totalPages - 1}
                onClick={() => onPageChange((page) => Math.min(totalPages - 1, page + 1))}
                className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Proxima
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
            Nome do mod
          </span>
          <input
            className="h-9 px-3 rounded-md border border-[#1f2329] bg-[#0f1114] text-sm text-neutral-200 focus:outline-none focus:border-amber-500 focus:shadow-[0_0_0_3px_rgba(245,158,11,0.15)] placeholder:text-neutral-600"
            placeholder="ex: Order of the Dracolich"
            value={newModName}
            onChange={(event) => onNewModNameChange(event.target.value)}
            autoFocus={mods.length === 0}
          />
        </div>
      )}
    </>
  )
}

function ModOption({
  mod,
  selected,
  onSelect
}: {
  mod: ModInfo
  selected: boolean
  onSelect: () => void
}): React.JSX.Element {
  const pct =
    mod.totalStrings > 0 ? Math.min((mod.translatedStrings / mod.totalStrings) * 100, 100) : 0
  const rel = formatRelativeDate(mod.updatedAt)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'grid items-center gap-3 px-3.5 py-3 rounded-lg border cursor-pointer transition-all text-left',
        'grid-cols-[20px_1fr_140px]',
        selected
          ? 'border-amber-500 bg-amber-400/10'
          : 'bg-[#0f1114] border-[#1f2329] hover:border-neutral-600 hover:bg-neutral-800/40'
      )}
    >
      <div
        className={cn(
          'w-4.5 h-4.5 rounded-full border flex items-center justify-center shrink-0',
          selected ? 'border-amber-400' : 'border-neutral-600'
        )}
      >
        {selected && <div className="w-2 h-2 rounded-full bg-amber-400" />}
      </div>

      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-neutral-200 truncate">{mod.name}</div>
        <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 mt-0.5">
          {mod.totalStrings > 0 && <span>{mod.totalStrings} strings</span>}
          {mod.totalStrings > 0 && rel && <span>-</span>}
          {rel && <span>{rel}</span>}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="h-1 bg-neutral-900 rounded overflow-hidden">
          <div
            className="h-full bg-amber-400 rounded transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="font-mono text-[10px] text-neutral-500 text-right tabular-nums">
          {pct.toFixed(0)}%
        </div>
      </div>
    </button>
  )
}
