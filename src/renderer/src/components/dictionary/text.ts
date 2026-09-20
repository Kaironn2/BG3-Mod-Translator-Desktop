import { decodeEntities, encodeEntities } from '@/lib/xmlEntities'

export function decodeDictionaryTextForUi(text: string): string {
  return decodeEntities(text)
}

export function encodeDictionaryTextForPersistence(text: string): string {
  return encodeEntities(text)
}
