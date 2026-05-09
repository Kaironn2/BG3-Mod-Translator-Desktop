import type { RepositoryRegistry } from '../database/repositories/registry'
import { normalizeDictionaryText } from '../utils/dictionaryText'
import { type LocalizationEntry, parseLocalizationXml } from './xml-parser.service'

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

  const targetBuckets = groupByUid(targetEntries)

  // Mod must exist before dictionary entries reference it via FK (modName -> mod.name).
  repos.mod.upsert(params.modName)

  let matched = 0
  for (const sourceEntry of sourceEntries) {
    const targetEntry = targetBuckets.get(sourceEntry.contentuid)?.shift()
    if (!targetEntry) continue

    const sourceText = normalizeDictionaryText(sourceEntry.text)
    const targetText = normalizeDictionaryText(targetEntry.text)
    if (!sourceText || !targetText) continue

    repos.dictionary.upsert({
      sourceLang: params.sourceLang,
      targetLang: params.targetLang,
      sourceText,
      targetText,
      modName: params.modName,
      uid: sourceEntry.contentuid
    })
    matched++
  }

  const sourceOnly = countMissingOccurrences(sourceEntries, targetEntries)
  const targetOnly = countMissingOccurrences(targetEntries, sourceEntries)

  if (matched > 0) {
    repos.mod.upsert(params.modName, { totalStrings: matched })
  }

  return { matched, sourceOnly, targetOnly }
}

function groupByUid(entries: LocalizationEntry[]): Map<string, LocalizationEntry[]> {
  const buckets = new Map<string, LocalizationEntry[]>()
  for (const entry of entries) {
    const bucket = buckets.get(entry.contentuid) ?? []
    bucket.push(entry)
    buckets.set(entry.contentuid, bucket)
  }
  return buckets
}

function countMissingOccurrences(a: LocalizationEntry[], b: LocalizationEntry[]): number {
  const aCounts = countUids(a)
  const bCounts = countUids(b)
  let count = 0
  for (const [uid, total] of aCounts) count += Math.max(0, total - (bCounts.get(uid) ?? 0))
  return count
}

function countUids(entries: LocalizationEntry[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const entry of entries) counts.set(entry.contentuid, (counts.get(entry.contentuid) ?? 0) + 1)
  return counts
}
