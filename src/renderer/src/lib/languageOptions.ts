import type { ThemedSelectOption } from '@/components/shared/ThemedSelect'
import {
  isOfficialBg3Language,
  toBg3LanguageFolder,
  type Language
} from '@/types'

export function compareLanguagesOfficialFirst(left: Language, right: Language): number {
  const leftOfficial = isOfficialBg3Language(left.code) ? 0 : 1
  const rightOfficial = isOfficialBg3Language(right.code) ? 0 : 1
  if (leftOfficial !== rightOfficial) return leftOfficial - rightOfficial
  return left.name.localeCompare(right.name)
}

// Display names come from i18n (languages.<code>), falling back to the seeded
// English name. The BG3 folder stays in searchText only (searchable, not shown).
export function languageToSelectOption(
  language: Language,
  officialMark: string,
  translateName: (code: string) => string
): ThemedSelectOption {
  const official = isOfficialBg3Language(language.code)
  const label = translateName(language.code)
  const folder = toBg3FolderLabel(language)
  return {
    value: language.code,
    label,
    searchText: `${label} ${language.name} ${language.code} ${folder}${official ? ` ${officialMark}` : ''}`,
    highlight: official,
    mark: official ? officialMark : undefined
  }
}

export function languagesToSelectOptions(
  languages: Language[],
  officialMark: string,
  translateName: (code: string) => string
): ThemedSelectOption[] {
  return [...languages]
    .sort((left, right) => {
      const leftOfficial = isOfficialBg3Language(left.code) ? 0 : 1
      const rightOfficial = isOfficialBg3Language(right.code) ? 0 : 1
      if (leftOfficial !== rightOfficial) return leftOfficial - rightOfficial
      // Sort by the TRANSLATED display label so the localized list reads naturally.
      return translateName(left.code).localeCompare(translateName(right.code))
    })
    .map((language) => languageToSelectOption(language, officialMark, translateName))
}

// BG3 folder name for the badge: official codes use the Larian folder, others
// strip non-alphanumerics from the seeded name (same rule as export path building).
function toBg3FolderLabel(language: Language): string {
  if (isOfficialBg3Language(language.code)) return toBg3LanguageFolder(language.code)
  return language.name.replace(/[^a-zA-Z0-9]/g, '')
}