import fs from 'node:fs'
import path from 'node:path'
import { ipcMain } from 'electron'
import type { RepositoryRegistry } from '../database/repositories/registry'
import { writeLocaFile } from '../services/loca/loca-writer'
import { decodeEntities, encodeEntities } from '../services/xml-entities.service'
import { loadXmlViaWorker, type XmlEntry } from '../services/xml-load.service'
import { writeLocalizationXml } from '../services/xml-parser.service'

interface LoadPayload {
  inputPath: string
  sourceLang: string
  targetLang: string
  modName?: string
}

interface ExportPayload {
  outputPath: string
  entries: XmlEntry[]
  // 'xml' (default) or 'loca'. Loca output must end in .loca - the game only loads
  // add-on binary locas, and in-game ones must be named as the language.
  fileType?: 'xml' | 'loca'
}

interface ExportMultiPayload {
  outputDir: string
  entries: XmlEntry[]
  // Used when entries carry no sourceFile info (legacy session / single import).
  fallbackFileName: string
  fileType?: 'xml' | 'loca'
}

function exportFile(payload: ExportPayload): void {
  const { outputPath, entries } = payload
  if (payload.fileType === 'loca') {
    const target = outputPath.toLowerCase().endsWith('.loca')
      ? outputPath
      : `${outputPath.replace(/\.(xml|loca)?$/i, '')}.loca`
    writeLocaFile(
      entries.map((entry) => ({
        key: entry.uid,
        version: Number.parseInt(entry.version, 10) || 1,
        // The binary stores markup raw; session text is already decoded.
        text: decodeEntities(entry.target || entry.source)
      })),
      target
    )
    return
  }
  const localizationEntries = entries.map((entry) => ({
    contentuid: entry.uid,
    version: entry.version,
    text: encodeEntities(entry.target || entry.source)
  }))
  writeLocalizationXml(localizationEntries, outputPath)
}

interface SourceFileGroup {
  fileName: string
  entries: XmlEntry[]
}

// Split entries into their original per-file groups (same rule as the package
// export): basename with an .xml/.loca extension. Output extension is forced
// to fileType (pak/zip always xml, explicit loca always .loca).
function groupEntriesBySourceFile(
  entries: XmlEntry[],
  fallbackFileName: string,
  fileType: 'xml' | 'loca' = 'xml'
): SourceFileGroup[] {
  const byLowerName = new Map<string, SourceFileGroup>()
  const order: string[] = []
  const unfiled: XmlEntry[] = []

  const groupFor = (fileName: string): SourceFileGroup => {
    const key = fileName.toLowerCase()
    let group = byLowerName.get(key)
    if (!group) {
      group = { fileName, entries: [] }
      byLowerName.set(key, group)
      order.push(key)
    }
    return group
  }

  for (const entry of entries) {
    const rawName = entry.sourceFile?.trim()
    if (!rawName || !/^[^\\/]+\.(xml|loca)$/i.test(rawName)) {
      unfiled.push(entry)
      continue
    }
    const targetExt = fileType === 'loca' ? '.loca' : '.xml'
    const fileName = rawName.replace(/\.(xml|loca)$/i, targetExt)
    groupFor(fileName).entries.push(entry)
  }

  if (order.length === 0) return [{ fileName: fallbackFileName, entries }]

  // Entries without file info ride along in the first group so nothing is
  // silently dropped from the export.
  if (unfiled.length > 0) {
    byLowerName.get(order[0])?.entries.push(...Array.from(unfiled))
  }
  return order.map((key) => byLowerName.get(key) as SourceFileGroup)
}

function exportPerSourceFile(payload: ExportMultiPayload): string[] {
  fs.mkdirSync(payload.outputDir, { recursive: true })
  const fileType = payload.fileType ?? 'xml'
  const groups = groupEntriesBySourceFile(payload.entries, payload.fallbackFileName, fileType)
  const written: string[] = []
  const usedNames = new Set<string>()
  for (const group of groups) {
    let fileName = path.basename(group.fileName)
    // Avoid clobbering a different group mapping onto the same file name.
    const targetExt = fileType === 'loca' ? '.loca' : '.xml'
    let suffix = 2
    while (usedNames.has(fileName.toLowerCase())) {
      fileName = group.fileName.replace(/\.(xml|loca)$/i, `_${suffix}${targetExt}`)
      suffix += 1
    }
    usedNames.add(fileName.toLowerCase())
    if (!fileName.toLowerCase().endsWith(targetExt)) {
      fileName = `${fileName.replace(/\.(xml|loca)?$/i, '')}${targetExt}`
    }
    const target = path.join(payload.outputDir, fileName)
    if (fileType === 'loca') {
      writeLocaFile(
        group.entries.map((entry) => ({
          key: entry.uid,
          version: Number.parseInt(entry.version, 10) || 1,
          text: decodeEntities(entry.target || entry.source)
        })),
        target
      )
    } else {
      const localizationEntries = group.entries.map((entry) => ({
        contentuid: entry.uid,
        version: entry.version,
        text: encodeEntities(entry.target || entry.source)
      }))
      writeLocalizationXml(localizationEntries, target)
    }
    written.push(target)
  }
  return written
}

export function registerXmlHandlers(repos: RepositoryRegistry): void {
  ipcMain.handle('xml:load', async (event, payload: LoadPayload) => {
    const result = await loadXmlViaWorker({
      ...payload,
      repos,
      onProgress: (p) => event.sender.send('xml:load:progress', p)
    })
    return result.entries
  })

  ipcMain.handle('xml:export', (_event, payload: ExportPayload) => exportFile(payload))

  ipcMain.handle('xml:exportPerSourceFile', (_event, payload: ExportMultiPayload) => {
    if (payload.entries.length === 0) return []
    return exportPerSourceFile(payload)
  })
}
