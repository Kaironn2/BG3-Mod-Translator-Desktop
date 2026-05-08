export const supportedLanguages = ['en', 'pt-BR'] as const

export type AppLanguage = (typeof supportedLanguages)[number]

export const defaultLanguage: AppLanguage = 'en'

export const languageLabels: Record<AppLanguage, string> = {
  en: 'English',
  'pt-BR': 'Português (Brasil)'
}

export function isSupportedLanguage(value: string | null | undefined): value is AppLanguage {
  return typeof value === 'string' && supportedLanguages.includes(value as AppLanguage)
}
