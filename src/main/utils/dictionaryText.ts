import { decodeEntities } from '../services/xml-entities.service'

export function normalizeDictionaryText(text: string): string {
  return decodeEntities(text).trim()
}

export function dictionaryTextKey(text: string): string {
  return normalizeDictionaryText(text).toLowerCase()
}
