import type { RepositoryRegistry } from '../database/repositories/registry'
import { decodeEntities } from './xml-entities.service'
import { parseLocalizationXml } from './xml-parser.service'

export interface MergeXmlsParams {
  sourceXmlPath: string
  sourceLang: string
  targetXmlPath: string
  targetLang: string
  modName: string
}

export interface MergeResult {
  matched: number
  sourceOnly: number
  targetOnly: number
}

export function mergeXmls(repos: RepositoryRegistry, params: MergeXmlsParams): MergeResult {
  const sourceEntries = parseLocalizationXml(params.sourceXmlPath)
  const targetEntries = parseLocalizationXml(params.targetXmlPath)

  const sourceMap = new Map<string, string>()
  for (const entry of sourceEntries) sourceMap.set(entry.contentuid, entry.text)

  const targetMap = new Map<string, string>()
  for (const entry of targetEntries) targetMap.set(entry.contentuid, entry.text)

  let matched = 0
  for (const [uid, rawSource] of sourceMap) {
    const rawTarget = targetMap.get(uid)
    if (rawTarget === undefined) continue

    const sourceText = decodeEntities(rawSource).trim()
    const targetText = decodeEntities(rawTarget).trim()
    if (!sourceText || !targetText) continue

    repos.dictionary.upsert({
      sourceLang: params.sourceLang,
      targetLang: params.targetLang,
      sourceText,
      targetText,
      modName: params.modName,
      uid
    })
    matched++
  }

  const sourceOnly = countMissing(sourceMap, targetMap)
  const targetOnly = countMissing(targetMap, sourceMap)

  if (matched > 0) {
    repos.mod.upsert(params.modName, { totalStrings: matched })
  }

  return { matched, sourceOnly, targetOnly }
}

function countMissing(a: Map<string, string>, b: Map<string, string>): number {
  let count = 0
  for (const key of a.keys()) if (!b.has(key)) count++
  return count
}
