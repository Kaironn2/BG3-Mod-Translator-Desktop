import {
  type CollisionDetection,
  closestCorners,
  DndContext,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Boxes, Info, Loader2, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { DeleteModConfirm } from '@/components/mods/DeleteModConfirm'
import {
  DroppableModList,
  OTHER_DROP_ID,
  PRIORITY_DROP_ID
} from '@/components/mods/DroppableModList'
import { FallbackModRow } from '@/components/mods/FallbackModRow'
import { ModListEmpty } from '@/components/mods/ModListEmpty'
import { PriorityModRow } from '@/components/mods/PriorityModRow'
import { AmberCheckbox } from '@/components/shared/AmberCheckbox'
import { useModDeleteSession } from '@/context/ModDeleteSession'
import { useManageMods } from '@/hooks/useManageMods'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { ModWithPriority } from '@/types'

const ROW_HEIGHT = 56

type ModListId = 'priority' | 'other'

function namesKey(mods: { name: string }[]): string {
  return mods.map((mod) => mod.name).join('\0')
}

const listCollision: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  const collisions = hits.length > 0 ? hits : rectIntersection(args)
  const overItem = collisions.find(
    (collision) => collision.id !== PRIORITY_DROP_ID && collision.id !== OTHER_DROP_ID
  )
  if (overItem) return [overItem]
  if (collisions.length > 0) return collisions
  return closestCorners(args)
}

export function ManageModsPage(): React.JSX.Element {
  const { t } = useAppTranslation('mods')
  const { mods, loading, refetch, promote, demote, moveUp, moveDown, setPosition, reorder } =
    useManageMods()
  const deleteJob = useModDeleteSession()

  const [searchQuery, setSearchQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [deleteTargets, setDeleteTargets] = useState<string[] | null>(null)
  const [deleteSource, setDeleteSource] = useState<ModListId | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overList, setOverList] = useState<ModListId | null>(null)
  const [draft, setDraft] = useState<{
    priority: ModWithPriority[]
    other: ModWithPriority[]
  } | null>(null)
  const draftRef = useRef(draft)
  draftRef.current = draft

  const query = searchQuery.trim().toLowerCase()
  const deleting = deleteJob.running
  const dragLocked = deleting || query.length > 0

  const prioritized = useMemo(
    () =>
      mods.filter((m) => m.priority != null).sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0)),
    [mods]
  )

  const fallback = useMemo(
    () =>
      mods
        .filter((m) => m.priority == null)
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [mods]
  )

  const prioritizedFiltered = useMemo(
    () => prioritized.filter((m) => !query || m.name.toLowerCase().includes(query)),
    [prioritized, query]
  )

  const fallbackFiltered = useMemo(
    () => fallback.filter((m) => !query || m.name.toLowerCase().includes(query)),
    [fallback, query]
  )

  const selectedPriority = useMemo(
    () => prioritized.filter((mod) => selected.has(mod.name)),
    [prioritized, selected]
  )
  const selectedFallback = useMemo(
    () => fallback.filter((mod) => selected.has(mod.name)),
    [fallback, selected]
  )

  useEffect(() => {
    if (deleteJob.status !== 'done') return
    setSelected(new Set())
    setDeleteTargets(null)
    setDeleteSource(null)
    void refetch()
    deleteJob.acknowledge()
  }, [deleteJob.acknowledge, deleteJob.status, refetch])

  const priorityScrollRef = useRef<HTMLDivElement>(null)
  const fallbackScrollRef = useRef<HTMLDivElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function listOf(
    id: string,
    lists?: { priority: ModWithPriority[]; other: ModWithPriority[] }
  ): ModListId | null {
    if (id === PRIORITY_DROP_ID) return 'priority'
    if (id === OTHER_DROP_ID) return 'other'
    const priorityList = lists?.priority ?? prioritized
    const otherList = lists?.other ?? fallback
    if (priorityList.some((mod) => mod.name === id)) return 'priority'
    if (otherList.some((mod) => mod.name === id)) return 'other'
    return null
  }

  function handleDragStart(event: DragStartEvent) {
    if (dragLocked) return
    setActiveId(String(event.active.id))
    setDraft({ priority: [...prioritized], other: [...fallback] })
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) {
      setOverList(null)
      return
    }

    const dragged = String(active.id)
    const overId = String(over.id)
    const current = draftRef.current
    if (!current) return

    const to = listOf(overId, current)
    setOverList(to)
    if (!to || overId === dragged) return

    setDraft((previous) => {
      if (!previous) return previous
      const from = listOf(dragged, previous)
      if (!from) return previous

      const fromItems = from === 'priority' ? previous.priority : previous.other
      const toItems = to === 'priority' ? previous.priority : previous.other
      const activeIndex = fromItems.findIndex((mod) => mod.name === dragged)
      if (activeIndex < 0) return previous

      const overIndex =
        overId === PRIORITY_DROP_ID || overId === OTHER_DROP_ID
          ? toItems.length
          : toItems.findIndex((mod) => mod.name === overId)
      if (overIndex < 0) return previous

      let nextPriority = previous.priority
      let nextOther = previous.other

      if (from === to) {
        if (activeIndex === overIndex) return previous
        const moved = arrayMove(fromItems, activeIndex, overIndex)
        if (from === 'priority') nextPriority = moved
        else nextOther = moved
      } else {
        const item = fromItems[activeIndex]
        const nextFrom = fromItems.filter((mod) => mod.name !== dragged)
        const nextTo = [...toItems]
        nextTo.splice(Math.min(overIndex, nextTo.length), 0, item)
        if (from === 'priority') {
          nextPriority = nextFrom
          nextOther = nextTo
        } else {
          nextOther = nextFrom
          nextPriority = nextTo
        }
      }

      if (
        namesKey(nextPriority) === namesKey(previous.priority) &&
        namesKey(nextOther) === namesKey(previous.other)
      ) {
        return previous
      }

      return { priority: nextPriority, other: nextOther }
    })
  }

  function handleDragEnd() {
    const snapshot = draftRef.current
    const dragged = activeId
    const originalPriority = namesKey(prioritized)
    setActiveId(null)
    setOverList(null)
    setDraft(null)
    if (dragLocked || !snapshot || !dragged) return

    if (namesKey(snapshot.priority) === originalPriority) return

    const wasPriority = prioritized.some((mod) => mod.name === dragged)
    const nowPriority = snapshot.priority.some((mod) => mod.name === dragged)

    void reorder(
      snapshot.priority.map((mod) => mod.name),
      { silent: true }
    ).then((ok) => {
      if (!ok) return
      if (wasPriority && !nowPriority) toast.success(t('toast.demoted', { name: dragged }))
      else if (!wasPriority && nowPriority) toast.success(t('toast.promoted', { name: dragged }))
      else toast.success(t('toast.reordered'))
    })
  }

  function handleDragCancel() {
    setActiveId(null)
    setOverList(null)
    setDraft(null)
  }

  const shownPriority = draft?.priority ?? prioritizedFiltered
  const shownOther = draft?.other ?? fallbackFiltered
  const homePriority = new Set(prioritized.map((mod) => mod.name))
  const homeOther = new Set(fallback.map((mod) => mod.name))
  const hiddenPriority = prioritized.find(
    (mod) => activeId === mod.name && !shownPriority.some((row) => row.name === mod.name)
  )
  const hiddenOther = fallback.find(
    (mod) => activeId === mod.name && !shownOther.some((row) => row.name === mod.name)
  )

  const priorityVirtualizer = useVirtualizer({
    count: shownPriority.length,
    getScrollElement: () => priorityScrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5
  })

  const fallbackVirtualizer = useVirtualizer({
    count: shownOther.length,
    getScrollElement: () => fallbackScrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5
  })

  const prioritySectionHeight = Math.max(160, Math.min(shownPriority.length * ROW_HEIGHT, 360))
  const isSearchActive = query.length > 0
  const activeMod = activeId ? mods.find((mod) => mod.name === activeId) : undefined

  function toggleSelected(name: string, checked: boolean) {
    setSelected((previous) => {
      const next = new Set(previous)
      if (checked) next.add(name)
      else next.delete(name)
      return next
    })
  }

  function setNamesSelected(names: string[], checked: boolean) {
    setSelected((previous) => {
      const next = new Set(previous)
      for (const name of names) {
        if (checked) next.add(name)
        else next.delete(name)
      }
      return next
    })
  }

  function requestDelete(scope: ModListId, names: string[]) {
    if (names.length === 0) return
    setDeleteSource(scope)
    setDeleteTargets(names)
  }

  const priorityAllSelected =
    prioritizedFiltered.length > 0 && prioritizedFiltered.every((mod) => selected.has(mod.name))
  const prioritySomeSelected = prioritizedFiltered.some((mod) => selected.has(mod.name))
  const fallbackAllSelected =
    fallbackFiltered.length > 0 && fallbackFiltered.every((mod) => selected.has(mod.name))
  const fallbackSomeSelected = fallbackFiltered.some((mod) => selected.has(mod.name))
  const allModsSelected = mods.length > 0 && mods.every((mod) => selected.has(mod.name))

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0f1114]">
      <header className="flex items-center justify-between border-b border-[#1f2329] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Boxes size={18} className="text-amber-500" />
            <span className="text-base font-semibold text-neutral-200">{t('title')}</span>
          </div>
          <span className="text-sm text-neutral-500">{t('subtitle')}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={deleting || mods.length === 0 || allModsSelected}
            onClick={() =>
              setNamesSelected(
                mods.map((mod) => mod.name),
                true
              )
            }
            className="inline-flex h-8 cursor-pointer items-center rounded-md border border-[#1f2329] bg-[#131518] px-3 text-xs font-medium text-neutral-300 transition-colors hover:bg-[#1f2329] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t('selection.selectAll')}
          </button>
          <div className="flex h-8 w-56 items-center gap-2 rounded-md border border-[#1f2329] bg-[#131518] px-3 focus-within:border-amber-500/50">
            <Search size={13} className="shrink-0 text-neutral-500" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('searchPlaceholder')}
              className="min-w-0 flex-1 bg-transparent text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none"
            />
          </div>
        </div>
      </header>

      <div className="mx-5 mt-4 flex gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
        <Info size={16} className="mt-0.5 shrink-0 text-amber-500" />
        <div className="text-sm">
          <p className="font-semibold text-amber-400">{t('priority.infoTitle')}</p>
          <p className="mt-0.5 text-neutral-400">{t('priority.infoBody')}</p>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={listCollision}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="icosa-scroll flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-5 py-4">
          <section className="flex flex-col">
            <SectionDeleteHeader
              title={`${t('priority.heading')} \u2014 ${prioritized.length} mods`}
              titleClassName="text-amber-500"
              matchingLabel={
                query && prioritizedFiltered.length !== prioritized.length
                  ? `(${prioritizedFiltered.length} matching)`
                  : null
              }
              allSelected={priorityAllSelected}
              someSelected={prioritySomeSelected}
              checkboxDisabled={deleting || prioritizedFiltered.length === 0}
              selectedCount={selectedPriority.length}
              selectedEntries={selectedPriority.reduce(
                (sum, mod) => sum + (mod.totalStrings ?? 0),
                0
              )}
              deleting={deleting && deleteSource === 'priority'}
              processed={deleteJob.processed}
              total={deleteJob.total}
              onToggleSection={(checked) =>
                setNamesSelected(
                  prioritizedFiltered.map((mod) => mod.name),
                  checked
                )
              }
              onDelete={() =>
                requestDelete(
                  'priority',
                  selectedPriority.map((mod) => mod.name)
                )
              }
              t={t}
            />

            {loading ? (
              <div className="rounded-lg border border-[#1f2329] bg-[#131518] px-4 py-6 text-center text-sm text-neutral-500">
                &hellip;
              </div>
            ) : (
              <DroppableModList
                id={PRIORITY_DROP_ID}
                highlighted={overList === 'priority'}
                className="overflow-hidden rounded-lg border border-[#1f2329] bg-[#0c0d0f]"
                style={{ maxHeight: `${prioritySectionHeight}px` }}
              >
                <SortableContext
                  items={prioritized.map((mod) => mod.name)}
                  strategy={verticalListSortingStrategy}
                >
                  <div ref={priorityScrollRef} className="icosa-scroll h-full overflow-y-auto">
                    {hiddenPriority ? (
                      <div className="hidden">
                        <PriorityModRow
                          mod={hiddenPriority}
                          index={0}
                          total={1}
                          selected={false}
                          onSelectedChange={() => undefined}
                          onMoveUp={() => undefined}
                          onMoveDown={() => undefined}
                          onSetPosition={() => undefined}
                          onDemote={() => undefined}
                          onDelete={() => undefined}
                        />
                      </div>
                    ) : null}
                    {shownPriority.length === 0 ? (
                      <ModListEmpty message={t('priority.empty')} />
                    ) : (
                      <div
                        style={{ height: priorityVirtualizer.getTotalSize(), position: 'relative' }}
                      >
                        {priorityVirtualizer.getVirtualItems().map((virtualItem) => {
                          const mod = shownPriority[virtualItem.index]
                          if (!mod) return null
                          const visiting = !homePriority.has(mod.name)
                          return (
                            <div
                              key={mod.name}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                transform: `translateY(${virtualItem.start}px)`
                              }}
                            >
                              {visiting ? (
                                <DropSlot name={mod.name} />
                              ) : (
                                <PriorityModRow
                                  mod={mod}
                                  index={virtualItem.index}
                                  total={shownPriority.length}
                                  selected={selected.has(mod.name)}
                                  disabled={deleting}
                                  onSelectedChange={(checked) => toggleSelected(mod.name, checked)}
                                  onMoveUp={() => moveUp(mod.name)}
                                  onMoveDown={() => moveDown(mod.name)}
                                  onSetPosition={(pos) => setPosition(mod.name, pos)}
                                  onDemote={() => demote(mod.name)}
                                  onDelete={() => requestDelete('priority', [mod.name])}
                                  isSearchActive={isSearchActive || deleting}
                                  dropPreview={activeId === mod.name}
                                />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </SortableContext>
              </DroppableModList>
            )}
          </section>

          <section className="flex min-h-0 flex-1 flex-col">
            <SectionDeleteHeader
              title={`${t('fallback.heading')} \u2014 ${fallback.length} mods`}
              titleClassName="text-neutral-500"
              matchingLabel={
                query && fallbackFiltered.length !== fallback.length
                  ? `(${fallbackFiltered.length} matching)`
                  : null
              }
              allSelected={fallbackAllSelected}
              someSelected={fallbackSomeSelected}
              checkboxDisabled={deleting || fallbackFiltered.length === 0}
              selectedCount={selectedFallback.length}
              selectedEntries={selectedFallback.reduce(
                (sum, mod) => sum + (mod.totalStrings ?? 0),
                0
              )}
              deleting={deleting && deleteSource === 'other'}
              processed={deleteJob.processed}
              total={deleteJob.total}
              onToggleSection={(checked) =>
                setNamesSelected(
                  fallbackFiltered.map((mod) => mod.name),
                  checked
                )
              }
              onDelete={() =>
                requestDelete(
                  'other',
                  selectedFallback.map((mod) => mod.name)
                )
              }
              t={t}
            />

            {loading ? (
              <div className="rounded-lg border border-[#1f2329] bg-[#131518] px-4 py-6 text-center text-sm text-neutral-500">
                &hellip;
              </div>
            ) : (
              <DroppableModList
                id={OTHER_DROP_ID}
                highlighted={overList === 'other'}
                className="min-h-0 flex-1 overflow-hidden rounded-lg border border-[#1f2329] bg-[#0c0d0f]"
              >
                <SortableContext
                  items={fallback.map((mod) => mod.name)}
                  strategy={verticalListSortingStrategy}
                >
                  <div ref={fallbackScrollRef} className="icosa-scroll h-full overflow-y-auto">
                    {hiddenOther ? (
                      <div className="hidden">
                        <FallbackModRow
                          mod={hiddenOther}
                          selected={false}
                          onSelectedChange={() => undefined}
                          onPromote={() => undefined}
                          onDelete={() => undefined}
                        />
                      </div>
                    ) : null}
                    {shownOther.length === 0 ? (
                      <ModListEmpty message={t('fallback.empty')} />
                    ) : (
                      <div
                        style={{ height: fallbackVirtualizer.getTotalSize(), position: 'relative' }}
                      >
                        {fallbackVirtualizer.getVirtualItems().map((virtualItem) => {
                          const mod = shownOther[virtualItem.index]
                          if (!mod) return null
                          const visiting = !homeOther.has(mod.name)
                          return (
                            <div
                              key={mod.name}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                transform: `translateY(${virtualItem.start}px)`
                              }}
                            >
                              {visiting ? (
                                <DropSlot name={mod.name} />
                              ) : (
                                <FallbackModRow
                                  mod={mod}
                                  selected={selected.has(mod.name)}
                                  disabled={deleting}
                                  onSelectedChange={(checked) => toggleSelected(mod.name, checked)}
                                  onPromote={() => promote(mod.name)}
                                  onDelete={() => requestDelete('other', [mod.name])}
                                  isSearchActive={isSearchActive || deleting}
                                  dropPreview={activeId === mod.name}
                                />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </SortableContext>
              </DroppableModList>
            )}
          </section>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeMod ? (
            <div className="w-[min(28rem,90vw)] cursor-grabbing rounded-md border border-amber-500/50 bg-[#131518] px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
              <p className="truncate text-sm font-medium text-neutral-200">{activeMod.name}</p>
              {activeMod.totalStrings != null && (
                <p className="text-xs text-neutral-500">
                  {activeMod.totalStrings.toLocaleString()} entries
                </p>
              )}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <DeleteModConfirm
        open={deleteTargets != null && deleteTargets.length > 0}
        modNames={deleteTargets ?? []}
        onClose={() => {
          setDeleteTargets(null)
          if (!deleting) setDeleteSource(null)
        }}
        onConfirm={(names) => {
          setDeleteTargets(null)
          void deleteJob.start(names)
        }}
      />
    </div>
  )
}

function DropSlot({ name }: { name: string }): React.JSX.Element {
  return (
    <div className="flex h-[56px] items-center border-b border-amber-500/40 bg-amber-500/15 px-4 ring-1 ring-inset ring-amber-500">
      <p className="truncate text-sm font-medium text-amber-100">{name}</p>
    </div>
  )
}

function SectionDeleteHeader({
  title,
  titleClassName,
  matchingLabel,
  allSelected,
  someSelected,
  checkboxDisabled,
  selectedCount,
  selectedEntries,
  deleting,
  processed,
  total,
  onToggleSection,
  onDelete,
  t
}: {
  title: string
  titleClassName: string
  matchingLabel: string | null
  allSelected: boolean
  someSelected: boolean
  checkboxDisabled: boolean
  selectedCount: number
  selectedEntries: number
  deleting: boolean
  processed: number
  total: number
  onToggleSection: (checked: boolean) => void
  onDelete: () => void
  t: (key: string, options?: Record<string, unknown>) => string
}): React.JSX.Element {
  return (
    <div className="mb-2">
      <div className="flex h-8 items-center gap-2">
        <AmberCheckbox
          checked={allSelected}
          indeterminate={someSelected && !allSelected}
          disabled={checkboxDisabled}
          title={t('selection.selectSection')}
          onChange={onToggleSection}
        />
        <h2 className={`text-xs font-semibold uppercase tracking-widest ${titleClassName}`}>
          {title}
        </h2>
        {matchingLabel && <span className="text-xs text-neutral-500">{matchingLabel}</span>}
        <div className="ml-auto flex items-center gap-3">
          <span className="min-w-52 text-right text-xs text-neutral-400 tabular-nums">
            {selectedCount > 0
              ? t('selection.headerSummary', {
                  mods: selectedCount,
                  rows: selectedEntries.toLocaleString()
                })
              : '\u00a0'}
          </span>
          <button
            type="button"
            disabled={deleting || selectedCount === 0}
            title={t('selection.delete')}
            onClick={onDelete}
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-red-500/40 bg-red-500/10 text-red-200 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        </div>
      </div>
      <div className="h-0.5 overflow-hidden rounded-full">
        {deleting && total > 0 ? (
          <div className="h-full overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full bg-amber-500 transition-[width] duration-200"
              style={{ width: `${Math.round((processed / total) * 100)}%` }}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
