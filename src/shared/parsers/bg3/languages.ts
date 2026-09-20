export const BG3_OFFICIAL_LANGUAGE_FOLDERS = {
  de: 'German',
  en: 'English',
  es: 'Spanish',
  'es-419': 'LatinSpanish',
  fr: 'French',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  pl: 'Polish',
  'pt-BR': 'BrazilianPortuguese',
  ru: 'Russian',
  tr: 'Turkish',
  uk: 'Ukrainian',
  'zh-CN': 'Chinese',
  'zh-TW': 'ChineseTraditional'
} as const

export type Bg3OfficialLanguageCode = keyof typeof BG3_OFFICIAL_LANGUAGE_FOLDERS

export function isOfficialBg3Language(code: string): code is Bg3OfficialLanguageCode {
  return Object.hasOwn(BG3_OFFICIAL_LANGUAGE_FOLDERS, code)
}

export function toBg3LanguageFolder(code: string, name?: string | null): string {
  if (isOfficialBg3Language(code)) return BG3_OFFICIAL_LANGUAGE_FOLDERS[code]
  return (name ?? code).replace(/[^a-zA-Z0-9]/g, '')
}
