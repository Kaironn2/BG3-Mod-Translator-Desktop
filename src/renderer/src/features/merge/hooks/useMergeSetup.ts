import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { Language, MergeResult, PreparedTranslationInput } from '@/types'
import type { MergeFileSlot, SlotKey } from '../types'

const ACCEPTED_EXT = ['xml', 'pak', 'zip']
const FILE_FILTERS = [{ name: 'Mod Files', extensions: ACCEPTED_EXT }]

function emptySlot(lang: string): MergeFileSlot {
  return {
    filePath: null,
    fileName: null,
    lang,
    importId: null,
    candidateId: null,
    prepared: null,
    isDragging: false,
    isPreparing: false
  }
}

function fileNameFromPath(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath
}

function hasAcceptedExt(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return ACCEPTED_EXT.includes(ext)
}

interface UseMergeSetupResult {
  source: MergeFileSlot
  target: MergeFileSlot
  modName: string
  languages: Language[]
  ready: boolean
  isRunning: boolean
  pendingSelection: SlotKey | null
  step1Done: boolean
  step2Done: boolean
  step3Done: boolean
  setSourceLang: (code: string) => void
  setTargetLang: (code: string) => void
  setModName: (value: string) => void
  setDragging: (slot: SlotKey, dragging: boolean) => void
  browseFile: (slot: SlotKey) => Promise<void>
  dropFile: (slot: SlotKey, event: React.DragEvent) => Promise<void>
  clearFile: (slot: SlotKey) => Promise<void>
  selectCandidate: (slot: SlotKey, candidateId: string) => void
  closeSelection: () => Promise<void>
  runMerge: () => Promise<void>
  reset: () => Promise<void>
}

export function useMergeSetup(): UseMergeSetupResult {
  const [source, setSource] = useState<MergeFileSlot>(() => emptySlot(''))
  const [target, setTarget] = useState<MergeFileSlot>(() => emptySlot(''))
  const [modName, setModName] = useState('')
  const [languages, setLanguages] = useState<Language[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [pendingSelection, setPendingSelection] = useState<SlotKey | null>(null)

  useEffect(() => {
    window.api.language.getAll().then((items) => {
      setLanguages(items)
      setSource((prev) => (prev.lang ? prev : { ...prev, lang: items[0]?.code ?? '' }))
      setTarget((prev) => (prev.lang ? prev : { ...prev, lang: items[1]?.code ?? items[0]?.code ?? '' }))
    })
  }, [])

  const updateSlot = useCallback(
    (key: SlotKey, updater: (prev: MergeFileSlot) => MergeFileSlot) => {
      if (key === 'source') setSource(updater)
      else setTarget(updater)
    },
    []
  )

  const getSlot = useCallback(
    (key: SlotKey): MergeFileSlot => (key === 'source' ? source : target),
    [source, target]
  )

  const prepare = useCallback(
    async (key: SlotKey, filePath: string, fileName: string) => {
      const previous = getSlot(key)
      if (previous.importId) {
        await window.api.merge.discardInput({ importId: previous.importId }).catch(() => undefined)
      }

      updateSlot(key, (prev) => ({
        ...prev,
        filePath,
        fileName,
        importId: null,
        candidateId: null,
        prepared: null,
        isPreparing: true
      }))

      let prepared: PreparedTranslationInput
      try {
        prepared = await window.api.merge.prepareInput({ inputPath: filePath })
      } catch (error) {
        updateSlot(key, () => emptySlot(previous.lang))
        toast.error(error instanceof Error ? error.message : 'Falha ao preparar arquivo')
        return
      }

      const validCandidates = prepared.candidates.filter((candidate) => candidate.valid)
      const autoCandidate = !prepared.requiresSelection
        ? prepared.candidates[0]
        : validCandidates.length === 1
          ? validCandidates[0]
          : null

      updateSlot(key, (prev) => ({
        ...prev,
        prepared,
        importId: prepared.importId,
        candidateId: autoCandidate?.id ?? null,
        isPreparing: false
      }))

      if (!autoCandidate) setPendingSelection(key)
    },
    [getSlot, updateSlot]
  )

  const browseFile = useCallback(
    async (key: SlotKey) => {
      const paths = await window.api.fs.openDialog({ filters: FILE_FILTERS })
      if (paths.length === 0) return
      await prepare(key, paths[0], fileNameFromPath(paths[0]))
    },
    [prepare]
  )

  const dropFile = useCallback(
    async (key: SlotKey, event: React.DragEvent) => {
      event.preventDefault()
      updateSlot(key, (prev) => ({ ...prev, isDragging: false }))
      const file = event.dataTransfer.files[0]
      if (!file) return
      if (!hasAcceptedExt(file.name)) {
        toast.error('Formato invalido. Use .xml, .pak ou .zip')
        return
      }
      const filePath = window.api.fs.getPathForFile(file)
      await prepare(key, filePath, file.name)
    },
    [prepare, updateSlot]
  )

  const clearFile = useCallback(
    async (key: SlotKey) => {
      const slot = getSlot(key)
      if (slot.importId) {
        await window.api.merge.discardInput({ importId: slot.importId }).catch(() => undefined)
      }
      updateSlot(key, () => emptySlot(slot.lang))
      if (pendingSelection === key) setPendingSelection(null)
    },
    [getSlot, pendingSelection, updateSlot]
  )

  const selectCandidate = useCallback(
    (key: SlotKey, candidateId: string) => {
      updateSlot(key, (prev) => ({ ...prev, candidateId }))
      setPendingSelection(null)
    },
    [updateSlot]
  )

  const closeSelection = useCallback(async () => {
    if (!pendingSelection) return
    await clearFile(pendingSelection)
  }, [clearFile, pendingSelection])

  const setDragging = useCallback(
    (key: SlotKey, dragging: boolean) => {
      updateSlot(key, (prev) => ({ ...prev, isDragging: dragging }))
    },
    [updateSlot]
  )

  const setSourceLang = useCallback(
    (code: string) => setSource((prev) => ({ ...prev, lang: code })),
    []
  )

  const setTargetLang = useCallback(
    (code: string) => setTarget((prev) => ({ ...prev, lang: code })),
    []
  )

  const reset = useCallback(async () => {
    if (source.importId) {
      await window.api.merge.discardInput({ importId: source.importId }).catch(() => undefined)
    }
    if (target.importId) {
      await window.api.merge.discardInput({ importId: target.importId }).catch(() => undefined)
    }
    setSource((prev) => emptySlot(prev.lang))
    setTarget((prev) => emptySlot(prev.lang))
    setModName('')
    setPendingSelection(null)
  }, [source.importId, target.importId])

  const step1Done = !!source.lang && !!source.importId && !!source.candidateId
  const step2Done = !!target.lang && !!target.importId && !!target.candidateId
  const step3Done = modName.trim().length > 0

  const ready =
    step1Done &&
    step2Done &&
    step3Done &&
    source.lang !== target.lang &&
    !isRunning

  const runMerge = useCallback(async () => {
    if (!ready) return
    if (!source.importId || !source.candidateId || !target.importId || !target.candidateId) return
    setIsRunning(true)
    try {
      const result: MergeResult = await window.api.merge.run({
        sourceImportId: source.importId,
        sourceCandidateId: source.candidateId,
        sourceLang: source.lang,
        targetImportId: target.importId,
        targetCandidateId: target.candidateId,
        targetLang: target.lang,
        modName: modName.trim()
      })

      const ignored = result.sourceOnly + result.targetOnly
      toast.success(
        ignored > 0
          ? `${result.matched} entradas mescladas (${ignored} ignoradas)`
          : `${result.matched} entradas mescladas`
      )

      // ImportIds are discarded on the main side after run; clear local state.
      setSource((prev) => emptySlot(prev.lang))
      setTarget((prev) => emptySlot(prev.lang))
      setModName('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao mesclar arquivos')
    } finally {
      setIsRunning(false)
    }
  }, [modName, ready, source, target])

  return {
    source,
    target,
    modName,
    languages,
    ready,
    isRunning,
    pendingSelection,
    step1Done,
    step2Done,
    step3Done,
    setSourceLang,
    setTargetLang,
    setModName,
    setDragging,
    browseFile,
    dropFile,
    clearFile,
    selectCandidate,
    closeSelection,
    runMerge,
    reset
  }
}
