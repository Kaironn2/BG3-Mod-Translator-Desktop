import type { ThemedSelectOption } from '@/components/shared/ThemedSelect'
import { isOfficialBg3Language, type Language } from '@/types'

export function compareLanguagesOfficialFirst(left: Language, right: Language): number {
  const leftOfficial = isOfficialBg3Language(left.code) ? 0 : 1
  const rightOfficial = isOfficialBg3Language(right.code) ? 0 : 1
  if (leftOfficial !== rightOfficial) return leftOfficial - rightOfficial
  return left.name.localeCompare(right.name)
}

export function languageToSelectOption(
  language: Language,
  officialMark: string
): ThemedSelectOption {
  const official = isOfficialBg3Language(language.code)
  return {
    value: language.code,
    label: language.name,
    badge: language.code.toUpperCase(),
    searchText: official
      ? `${language.name} ${language.code} ${officialMark}`
      : `${language.name} ${language.code}`,
    highlight: official,
    mark: official ? officialMark : undefined
  }
}

export function languagesToSelectOptions(
  languages: Language[],
  officialMark: string
): ThemedSelectOption[] {
  return [...languages]
    .sort(compareLanguagesOfficialFirst)
    .map((language) => languageToSelectOption(language, officialMark))
}
