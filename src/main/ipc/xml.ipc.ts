import { ipcMain } from 'electron'
import path from 'node:path'
import type { RepositoryRegistry } from '../database/repositories/registry'
import { getDictionaryTargetText } from '../database/repositories/dictionary.repo'
import { unpackMod } from '../services/lslib.service'
import {
  type LocalizationEntry,
  findLocalizationXmls,
  parseLocalizationXml,
  writeLocalizationXml
} from '../services/xml-parser.service'
import { decodeEntities, encodeEntities } from '../services/xml-entities.service'
import { extract } from '../services/zip.service'
import { findPakFiles } from '../utils/findPakFiles'
import { cleanupTempDir, createTempDir } from '../utils/tempDir'

interface XmlEntry {
  uid: string
  version: string
  source: string
  target: string
  matchType: 'none' | 'mod-text' | 'text' | 'manual'
}

interface LoadPayload {
  inputPath: string
  sourceLang: string
  targetLang: string
  modName?: string
}

interface ExportPayload {
  outputPath: string
  entries: XmlEntry[]
}

function toUiEntry(entry: LocalizationEntry): Pick<XmlEntry, 'uid' | 'version' | 'source'> {
  return {
    uid: entry.contentuid,
    version: entry.version,
    source: decodeEntities(entry.text)
  }
}

async function loadXml(repos: RepositoryRegistry, payload: LoadPayload): Promise<XmlEntry[]> {
  const { inputPath, sourceLang, targetLang, modName } = payload
  const ext = path.extname(inputPath).toLowerCase()

  let xmlPath: string
  const tempDirs: string[] = []

  try {
    if (ext === '.xml') {
      xmlPath = inputPath
    } else if (ext === '.pak') {
      const tempDir = createTempDir('icosa_xml')
      tempDirs.push(tempDir)
      await unpackMod(inputPath, tempDir)
      const xmlFiles = findLocalizationXmls(tempDir, sourceLang)
      if (xmlFiles.length === 0) throw new Error(`No XML found for language "${sourceLang}" in pak`)
      xmlPath = xmlFiles[0]
    } else if (ext === '.zip') {
      const archiveDir = createTempDir('icosa_zip')
      tempDirs.push(archiveDir)
      extract(inputPath, archiveDir)
      const pakFiles = findPakFiles(archiveDir)
      if (pakFiles.length === 0) throw new Error('No .pak file found inside zip')

      const unpackedDir = createTempDir('icosa_pak')
      tempDirs.push(unpackedDir)
      await unpackMod(pakFiles[0], unpackedDir)
      const xmlFiles = findLocalizationXmls(unpackedDir, sourceLang)
      if (xmlFiles.length === 0) throw new Error(`No XML found for language "${sourceLang}" in pak`)
      xmlPath = xmlFiles[0]
    } else {
      throw new Error(`Unsupported file type: ${ext}. Use .xml, .pak, or .zip`)
    }

    const localizationEntries = parseLocalizationXml(xmlPath)

    return localizationEntries.map((entry) => {
      const uiEntry = toUiEntry(entry)
      const match = repos.dictionary.resolveMatch({
        modName: modName ?? null,
        sourceLang,
        targetLang,
        sourceText: entry.text
      })

      if (match) {
        return {
          ...uiEntry,
          target: decodeEntities(getDictionaryTargetText(match.entry, sourceLang, targetLang)),
          matchType: match.matchType
        }
      }

      return {
        ...uiEntry,
        target: '',
        matchType: 'none'
      }
    })
  } finally {
    for (const tempDir of tempDirs) cleanupTempDir(tempDir)
  }
}

function exportXml(payload: ExportPayload): void {
  const { outputPath, entries } = payload
  const localizationEntries = entries.map((entry) => ({
    contentuid: entry.uid,
    version: entry.version,
    text: encodeEntities(entry.target || entry.source)
  }))
  writeLocalizationXml(localizationEntries, outputPath)
}

export function registerXmlHandlers(repos: RepositoryRegistry): void {
  ipcMain.handle('xml:load', async (_event, payload: LoadPayload) => loadXml(repos, payload))
  ipcMain.handle('xml:export', (_event, payload: ExportPayload) => exportXml(payload))
}
