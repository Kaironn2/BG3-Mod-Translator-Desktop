import { useTranslation } from 'react-i18next'
import { languageLabels, type AppLanguage } from './languages'
import type { translationNamespaces } from './resources'

type Namespace = (typeof translationNamespaces)[number]

export function useAppTranslation(ns?: Namespace | Namespace[]) {
  const translation = useTranslation(ns)

  return {
    ...translation,
    currentLanguage: translation.i18n.language as AppLanguage,
    languageLabels
  }
}
