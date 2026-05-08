import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { defaultLanguage, isSupportedLanguage, supportedLanguages } from './languages'
import { resources, translationNamespaces } from './resources'

let initialized = false

export async function initI18n(): Promise<typeof i18n> {
  if (!initialized) {
    await i18n.use(initReactI18next).init({
      resources,
      lng: defaultLanguage,
      fallbackLng: defaultLanguage,
      supportedLngs: supportedLanguages,
      defaultNS: 'common',
      ns: translationNamespaces,
      interpolation: { escapeValue: false },
      returnNull: false,
      react: { useSuspense: false }
    })
    initialized = true
  }

  const allConfig = await window.api.config.getAll()
  if (isSupportedLanguage(allConfig.app_language)) {
    await i18n.changeLanguage(allConfig.app_language)
  } else if (i18n.language !== defaultLanguage) {
    await i18n.changeLanguage(defaultLanguage)
  }

  return i18n
}

export { i18n }
