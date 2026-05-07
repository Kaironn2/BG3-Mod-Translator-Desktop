import type { Language } from '@/types'

export function languageToBg3Folder(language: Language | undefined, fallback: string): string {
  return (language?.name ?? fallback).replace(/[^a-zA-Z0-9]/g, '')
}

export function exportFileBaseName(modName: string, targetLang: string): string {
  const langSuffix = targetLang.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  const baseName = `${modName} ${langSuffix}`
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('')
  return baseName || 'Traducao'
}
