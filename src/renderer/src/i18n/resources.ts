import commonEn from '@/locales/en/common.json'
import dictionaryEn from '@/locales/en/dictionary.json'
import errorsEn from '@/locales/en/errors.json'
import extractEn from '@/locales/en/extract.json'
import mergeEn from '@/locales/en/merge.json'
import metricsEn from '@/locales/en/metrics.json'
import modsEn from '@/locales/en/mods.json'
import packageEn from '@/locales/en/package.json'
import settingsEn from '@/locales/en/settings.json'
import sidebarEn from '@/locales/en/sidebar.json'
import toastsEn from '@/locales/en/toasts.json'
import translateEn from '@/locales/en/translate.json'
import commonPtBr from '@/locales/pt-BR/common.json'
import dictionaryPtBr from '@/locales/pt-BR/dictionary.json'
import errorsPtBr from '@/locales/pt-BR/errors.json'
import extractPtBr from '@/locales/pt-BR/extract.json'
import mergePtBr from '@/locales/pt-BR/merge.json'
import metricsPtBr from '@/locales/pt-BR/metrics.json'
import modsPtBr from '@/locales/pt-BR/mods.json'
import packagePtBr from '@/locales/pt-BR/package.json'
import settingsPtBr from '@/locales/pt-BR/settings.json'
import sidebarPtBr from '@/locales/pt-BR/sidebar.json'
import toastsPtBr from '@/locales/pt-BR/toasts.json'
import translatePtBr from '@/locales/pt-BR/translate.json'

export const translationNamespaces = [
  'common',
  'settings',
  'sidebar',
  'translate',
  'dictionary',
  'merge',
  'mods',
  'package',
  'extract',
  'errors',
  'toasts',
  'metrics'
] as const

export const resources = {
  en: {
    common: commonEn,
    settings: settingsEn,
    sidebar: sidebarEn,
    translate: translateEn,
    dictionary: dictionaryEn,
    merge: mergeEn,
    mods: modsEn,
    package: packageEn,
    extract: extractEn,
    errors: errorsEn,
    toasts: toastsEn,
    metrics: metricsEn
  },
  'pt-BR': {
    common: commonPtBr,
    settings: settingsPtBr,
    sidebar: sidebarPtBr,
    translate: translatePtBr,
    dictionary: dictionaryPtBr,
    merge: mergePtBr,
    mods: modsPtBr,
    package: packagePtBr,
    extract: extractPtBr,
    errors: errorsPtBr,
    toasts: toastsPtBr,
    metrics: metricsPtBr
  }
} as const
