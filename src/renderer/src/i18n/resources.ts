import aiEn from '@/locales/en/ai.json'
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
import updaterEn from '@/locales/en/updater.json'
import aiPtBr from '@/locales/pt-BR/ai.json'
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
import updaterPtBr from '@/locales/pt-BR/updater.json'

export const translationNamespaces = [
  'ai',
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
  'metrics',
  'updater'
] as const

export const resources = {
  en: {
    ai: aiEn,
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
    metrics: metricsEn,
    updater: updaterEn
  },
  'pt-BR': {
    ai: aiPtBr,
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
    metrics: metricsPtBr,
    updater: updaterPtBr
  }
} as const
