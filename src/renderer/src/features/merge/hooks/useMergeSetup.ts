import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getLocalizedErrorMessage } from '@/i18n/errors'
import { useAppTranslation } from '@/i18n/useAppTranslation'
import type { Language, MergeProgress, MergeResult, PreparedTranslationInput } from '@/types'
import type { MergeFileSlot, SlotKey } from '../types'

const ACCEPTED_EXT = ['xml', 'loca', 'pak', 'zip']
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
    isPreparing: false,
    prepareRequestId: null,
    prepareProgress: null
  }
}

function fileNameFromPath(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath
}

function hasAcceptedExt(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return ACCEPTED_EXT.includes(ext)
}

function isPrepareCancelled(error: unknown): boolean {
  if (error instanceof Error) return error.message === 'PREPARE_CANCELLED'
  return String(error).includes('PREPARE_CANCELLED')
}

export interface UseMergeSetupResult {
  source: MergeFileSlot
  target: MergeFileSlot
  modName: string
  languages: Language[]
  ready: boolean
  isRunning: boolean
  progress: MergeProgress | null
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
  const { t } = useAppTranslation(['merge', 'toasts', 'common'])
  const [source, setSource] = useState<MergeFileSlot>(() => emptySlot(''))
  const [target, setTarget] = useState<MergeFileSlot>(() => emptySlot(''))
  const [modName, setModName] = useState('')
  const [languages, setLanguages] = useState<Language[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState<MergeProgress | null>(null)
  const [pendingSelection, setPendingSelection] = useState<SlotKey | null>(null)
  const inflightRef = useRef<{ source: string | null; target: string | null }>({
    source: null,
    target: null
  })
  const slotsRef = useRef({ source, target })
  slotsRef.current = { source, target }

  useEffect(() => {
    const unsub = window.api.merge.onProgress(setProgress)
    return unsub
  }, [])

  useEffect(() => {
    const unsub = window.api.merge.onPrepareProgress((event) => {
      const apply = (prev: MergeFileSlot): MergeFileSlot =>
        prev.prepareRequestId === event.requestId ? { ...prev, prepareProgress: event } : prev
      setSource(apply)
      setTarget(apply)
    })
    return unsub
  }, [])

  useEffect(() => {
    window.api.language.getAll().then((items) => {
      const sourceDefault = items.find((item) => item.code === 'en')?.code ?? items[0]?.code ?? ''
      const targetDefault =
        items.find((item) => item.code === 'pt-BR')?.code ?? items[1]?.code ?? items[0]?.code ?? ''

      setLanguages(items)
      setSource((prev) => (prev.lang ? prev : { ...prev, lang: sourceDefault }))
      setTarget((prev) => (prev.lang ? prev : { ...prev, lang: targetDefault }))
    })
  }, [])

  const updateSlot = useCallback(
    (key: SlotKey, updater: (prev: MergeFileSlot) => MergeFileSlot) => {
      if (key === 'source') setSource(updater)
      else setTarget(updater)
    },
    []
  )

  const getSlot = useCallback((key: SlotKey): MergeFileSlot => slotsRef.current[key], [])

  const queueSelectionIfNeeded = useCallback((key: SlotKey) => {
    setPendingSelection((prev) => {
      if (prev) return prev
      return key
    })
  }, [])

  const advanceSelection = useCallback((cleared: SlotKey) => {
    setPendingSelection((prev) => {
      if (prev && prev !== cleared) return prev
      const other: SlotKey = cleared === 'source' ? 'target' : 'source'
      const otherSlot = slotsRef.current[other]
      if (otherSlot.prepared && !otherSlot.candidateId) return other
      return null
    })
  }, [])

  const prepare = useCallback(
    async (key: SlotKey, filePath: string, fileName: string) => {
      const previous = getSlot(key)
      if (previous.prepareRequestId) {
        inflightRef.current[key] = null
        await window.api.merge
          .cancelPrepare({ requestId: previous.prepareRequestId })
          .catch(() => undefined)
      }
      if (previous.importId) {
        await window.api.merge.discardInput({ importId: previous.importId }).catch(() => undefined)
      }

      const requestId = crypto.randomUUID()
      inflightRef.current[key] = requestId
      updateSlot(key, (prev) => ({
        ...prev,
        filePath,
        fileName,
        importId: null,
        candidateId: null,
        prepared: null,
        isPreparing: true,
        prepareRequestId: requestId,
        prepareProgress: null
      }))

      let prepared: PreparedTranslationInput
      try {
        prepared = await window.api.merge.prepareInput({ inputPath: filePath, requestId })
      } catch (error) {
        if (isPrepareCancelled(error) || inflightRef.current[key] !== requestId) return
        inflightRef.current[key] = null
        updateSlot(key, () => emptySlot(previous.lang))
        toast.error(getLocalizedErrorMessage(error, t))
        return
      }

      if (inflightRef.current[key] !== requestId) {
        await window.api.merge.discardInput({ importId: prepared.importId }).catch(() => undefined)
        return
      }

      inflightRef.current[key] = null
      const validCandidates = prepared.candidates.filter((candidate) => candidate.valid)
      const autoCandidate = !prepared.requiresSelection
        ? prepared.candidates[0]
        : validCandidates.length === 1
          ? validCandidates[0]
          : null

      updateSlot(key, (prev) => {
        if (prev.prepareRequestId !== requestId) return prev
        return {
          ...prev,
          prepared,
          importId: prepared.importId,
          candidateId: autoCandidate?.id ?? null,
          isPreparing: false,
          prepareRequestId: null,
          prepareProgress: null
        }
      })

      if (!autoCandidate) queueSelectionIfNeeded(key)
    },
    [getSlot, queueSelectionIfNeeded, t, updateSlot]
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
        toast.error(t('merge.invalidFormat', { ns: 'toasts' }))
        return
      }
      const filePath = window.api.fs.getPathForFile(file)
      await prepare(key, filePath, file.name)
    },
    [prepare, t, updateSlot]
  )

  const clearFile = useCallback(
    async (key: SlotKey) => {
      const slot = getSlot(key)
      inflightRef.current[key] = null
      if (slot.prepareRequestId) {
        await window.api.merge
          .cancelPrepare({ requestId: slot.prepareRequestId })
          .catch(() => undefined)
      }
      if (slot.importId) {
        await window.api.merge.discardInput({ importId: slot.importId }).catch(() => undefined)
      }
      updateSlot(key, () => emptySlot(slot.lang))
      advanceSelection(key)
    },
    [advanceSelection, getSlot, updateSlot]
  )

  const selectCandidate = useCallback(
    (key: SlotKey, candidateId: string) => {
      updateSlot(key, (prev) => ({ ...prev, candidateId }))
      advanceSelection(key)
    },
    [advanceSelection, updateSlot]
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
    const current = slotsRef.current
    inflightRef.current.source = null
    inflightRef.current.target = null
    if (current.source.prepareRequestId) {
      await window.api.merge
        .cancelPrepare({ requestId: current.source.prepareRequestId })
        .catch(() => undefined)
    }
    if (current.target.prepareRequestId) {
      await window.api.merge
        .cancelPrepare({ requestId: current.target.prepareRequestId })
        .catch(() => undefined)
    }
    if (current.source.importId) {
      await window.api.merge
        .discardInput({ importId: current.source.importId })
        .catch(() => undefined)
    }
    if (current.target.importId) {
      await window.api.merge
        .discardInput({ importId: current.target.importId })
        .catch(() => undefined)
    }
    setSource((prev) => emptySlot(prev.lang))
    setTarget((prev) => emptySlot(prev.lang))
    setModName('')
    setPendingSelection(null)
  }, [])

  const step1Done = !!source.lang && !!source.importId && !!source.candidateId
  const step2Done = !!target.lang && !!target.importId && !!target.candidateId
  const step3Done = modName.trim().length > 0

  const ready = step1Done && step2Done && step3Done && source.lang !== target.lang && !isRunning

  const runMerge = useCallback(async () => {
    if (!ready) return
    if (!source.importId || !source.candidateId || !target.importId || !target.candidateId) return
    setIsRunning(true)
    setProgress(null)
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
        t(ignored > 0 ? 'merge.mergedWithIgnored' : 'merge.merged', {
          ns: 'toasts',
          matched: result.matched,
          ignored
        })
      )

      setSource((prev) => emptySlot(prev.lang))
      setTarget((prev) => emptySlot(prev.lang))
      setModName('')
    } catch (error) {
      toast.error(getLocalizedErrorMessage(error, t))
    } finally {
      setIsRunning(false)
      setProgress(null)
    }
  }, [modName, ready, source, t, target])

  return {
    source,
    target,
    modName,
    languages,
    ready,
    isRunning,
    progress,
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
