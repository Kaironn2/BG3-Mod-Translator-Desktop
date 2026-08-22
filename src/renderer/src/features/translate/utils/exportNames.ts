import { type Language, toBg3LanguageFolder } from '@/types'

export function languageToBg3Folder(language: Language | undefined, fallback: string): string {
  return toBg3LanguageFolder(language?.code ?? fallback, language?.name)
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
