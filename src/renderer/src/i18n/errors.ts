import type { TFunction } from 'i18next'
import type { UserErrorCode } from '@/types'

const USER_ERROR_PREFIX = '[user-error:'

const legacyErrorMap = new Map<string, UserErrorCode>([
  ['XLSX import not yet supported', 'dictionary.xlsxNotSupported'],
  ['XLSX export not yet supported', 'dictionary.xlsxNotSupported'],
  ['No .pak file found inside archive', 'common.noPakInArchive'],
  ['No .pak file found inside zip', 'common.noPakInArchive'],
  ['No .pak file found inside the ZIP archive', 'common.noPakInArchive'],
  ['No localization XML files found in package', 'common.noXmlForLanguage'],
  ['DeepL API key is required', 'translation.apiKeyRequired'],
  ['OpenAI API key is required', 'translation.apiKeyRequired'],
  ['Mod name is required', 'merge.modNameRequired'],
  ['Source and target languages must differ', 'merge.languagesMustDiffer'],
  ['Source import session expired. Select the file again.', 'merge.sessionExpired'],
  ['Target import session expired. Select the file again.', 'merge.sessionExpired'],
  ['Source XML has an invalid format', 'merge.invalidXml'],
  ['Target XML has an invalid format', 'merge.invalidXml'],
  ['Selected XML has an invalid format', 'merge.invalidXml'],
  ['Selected XML was not found', 'merge.sessionExpired'],
  ['No valid XML found', 'translation.noValidXml'],
  ['Formato invalido', 'translation.invalidFormat']
])

function readUserErrorCode(message: string): UserErrorCode | null {
  if (!message.startsWith(USER_ERROR_PREFIX)) return null
  const end = message.indexOf(']')
  if (end === -1) return null
  return message.slice(USER_ERROR_PREFIX.length, end) as UserErrorCode
}

export function getLocalizedErrorMessage(error: unknown, t: TFunction): string {
  const message = error instanceof Error ? error.message : String(error)
  const code = readUserErrorCode(message) ?? legacyErrorMap.get(message)

  if (code) {
    return t(code, { ns: 'errors' })
  }

  return message || t('common.unknown', { ns: 'errors' })
}

export function createUserErrorMessage(code: UserErrorCode, detail?: string): string {
  return detail ? `${USER_ERROR_PREFIX}${code}] ${detail}` : `${USER_ERROR_PREFIX}${code}]`
}
