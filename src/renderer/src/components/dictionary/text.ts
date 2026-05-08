import { decodeEntities, encodeEntities } from '@/lib/xmlEntities'

const REPLACE_REGION_PATTERN = /(<[^>]+>|\{[^}]+\})/g
const PLACEHOLDER_PREFIX = '__ICOSA_DICT_REGION_'

export function decodeDictionaryTextForUi(text: string): string {
  return decodeEntities(text)
}

export function encodeDictionaryTextForPersistence(text: string): string {
  return encodeEntities(text)
}

export function protectReplaceRegions(text: string): {
  protectedText: string
  regions: string[]
} {
  const regions: string[] = []
  const protectedText = text.replace(REPLACE_REGION_PATTERN, (segment) => {
    const index = regions.push(segment) - 1
    return `${PLACEHOLDER_PREFIX}${index}__`
  })

  return { protectedText, regions }
}

export function restoreProtectedRegions(text: string, regions: string[]): string {
  let restored = text

  for (let index = 0; index < regions.length; index++) {
    restored = restored.replaceAll(`${PLACEHOLDER_PREFIX}${index}__`, regions[index])
  }

  return restored
}
