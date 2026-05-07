import { useEffect, useState } from 'react'
import type { ModInfo } from '@/types'
import type { TranslationSession } from '../types'

const MODS_PER_PAGE = 6

export function useTranslateSetup(session: TranslationSession) {
  const [sourceLang, setSourceLangLocal] = useState(session.sourceLang)
  const [targetLang, setTargetLangLocal] = useState(session.targetLang)
  const [selectedMod, setSelectedMod] = useState<string | null>(null)
  const [isNewMod, setIsNewMod] = useState(false)
  const [newModName, setNewModName] = useState('')
  const [filePath, setFilePath] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [mods, setMods] = useState<ModInfo[]>([])
  const [languages, setLanguages] = useState<
    Awaited<ReturnType<typeof window.api.language.getAll>>
  >([])
  const [modSearch, setModSearch] = useState('')
  const [modPage, setModPage] = useState(0)

  const filteredMods = mods.filter((mod) =>
    mod.name.toLowerCase().includes(modSearch.toLowerCase())
  )
  const totalPages = Math.max(1, Math.ceil(filteredMods.length / MODS_PER_PAGE))
  const clampedPage = Math.min(modPage, totalPages - 1)
  const pagedMods = filteredMods.slice(
    clampedPage * MODS_PER_PAGE,
    (clampedPage + 1) * MODS_PER_PAGE
  )

  const modName = isNewMod ? newModName.trim() : (selectedMod ?? '')
  const step1Done = !!(sourceLang && targetLang && sourceLang !== targetLang)
  const step2Done = !!(isNewMod ? newModName.trim() : selectedMod)
  const step3Done = !!filePath
  const ready = step1Done && step2Done && step3Done

  const srcLang = languages.find((language) => language.code === sourceLang)
  const tgtLang = languages.find((language) => language.code === targetLang)

  useEffect(() => {
    window.api.language.getAll().then(setLanguages)
  }, [])

  useEffect(() => {
    if (sourceLang && targetLang) {
      window.api.mod.getAll({ lang1: sourceLang, lang2: targetLang }).then(setMods)
    }
  }, [sourceLang, targetLang])

  useEffect(() => {
    if (mods.length === 0) {
      setIsNewMod(true)
      setSelectedMod(null)
    }
  }, [mods])

  const handleSourceChange = (lang: string) => {
    setSourceLangLocal(lang)
    session.setSourceLang(lang)
    window.api.config.set({ key: 'last_source_lang', value: lang })
  }

  const handleTargetChange = (lang: string) => {
    setTargetLangLocal(lang)
    session.setTargetLang(lang)
    window.api.config.set({ key: 'last_target_lang', value: lang })
  }

  const handleModSelect = (mod: ModInfo) => {
    setSelectedMod(mod.name)
    if (mod.lastFilePath) {
      setFilePath(mod.lastFilePath)
      setFileName(mod.lastFilePath.split(/[\\/]/).pop() ?? mod.lastFilePath)
    }
  }

  const handleModSearchChange = (query: string) => {
    setModSearch(query)
    setModPage(0)
  }

  const handleBrowse = async () => {
    const paths = await window.api.fs.openDialog({
      filters: [{ name: 'Mod Files', extensions: ['xml', 'pak', 'zip'] }]
    })
    if (paths.length > 0) {
      setFilePath(paths[0])
      setFileName(paths[0].split(/[\\/]/).pop() ?? paths[0])
    }
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files[0]
    if (!file) return
    const path = window.api.fs.getPathForFile(file)
    setFilePath(path)
    setFileName(file.name)
  }

  const clearFile = () => {
    setFilePath(null)
    setFileName(null)
  }

  return {
    sourceLang,
    targetLang,
    selectedMod,
    isNewMod,
    newModName,
    filePath,
    fileName,
    isDragging,
    mods,
    languages,
    modSearch,
    modPage,
    filteredMods,
    pagedMods,
    totalPages,
    clampedPage,
    modName,
    step1Done,
    step2Done,
    step3Done,
    ready,
    srcLang,
    tgtLang,
    setIsNewMod,
    setNewModName,
    setIsDragging,
    setModPage,
    handleSourceChange,
    handleTargetChange,
    handleModSelect,
    handleModSearchChange,
    handleBrowse,
    handleDrop,
    clearFile
  }
}
