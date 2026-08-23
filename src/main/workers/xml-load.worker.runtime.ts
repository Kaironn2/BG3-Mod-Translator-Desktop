import path from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import {
  DictionaryRepository,
  getDictionaryTargetText
} from '../database/repositories/dictionary.repo'
import { ModRepository } from '../database/repositories/mod.repo'
import * as schema from '../database/schema'
import { applySqlitePragmas } from '../database/sqlite-pragmas'
import { unpackMod } from '../services/lslib.service'
import { decodeEntities } from '../services/xml-entities.service'
import {
  findLocalizationXmls,
  type LocalizationEntry,
  parseLocalizationXml
} from '../services/xml-parser.service'
import { extract } from '../services/zip.service'
import { findPakFiles } from '../utils/findPakFiles'
import { cleanupTempDir, createTempDir } from '../utils/tempDir'

export interface XmlLoadWorkerInput {
  inputPath: string
  sourceLang: string
  targetLang: string
  modName?: string
  sourceFolder: string
  dbPath: string
}

export interface XmlEntry {
  uid: string
  version: string
  source: string
  target: string
  matchType: 'none' | 'mod-text' | 'text' | 'manual'
}

export interface XmlLoadResult {
  entries: XmlEntry[]
}

export type XmlLoadProgress =
  | { phase: 'unpacking' }
  | { phase: 'parsing' }
  | { phase: 'loading-cache' }
  | { phase: 'matching'; processed: number; total: number }
  | { phase: 'done'; result: XmlLoadResult }
  | { phase: 'error'; message: string }

const MATCH_CHUNK = 500

function toUiEntry(entry: LocalizationEntry): Pick<XmlEntry, 'uid' | 'version' | 'source'> {
  return {
    uid: entry.contentuid,
    version: entry.version,
    source: decodeEntities(entry.text)
  }
}

export async function runXmlLoadWorker(
  input: XmlLoadWorkerInput,
  post: (msg: XmlLoadProgress) => void
): Promise<void> {
  const sqlite = new Database(input.dbPath)
  applySqlitePragmas(sqlite)

  const tempDirs: string[] = []

  try {
    const db = drizzle(sqlite, { schema })
    const { inputPath, sourceLang, targetLang, modName, sourceFolder } = input
    const ext = path.extname(inputPath).toLowerCase()

    let xmlPath: string

    if (ext === '.xml') {
      xmlPath = inputPath
    } else if (ext === '.pak') {
      post({ phase: 'unpacking' })
      const tempDir = createTempDir('icosa_xml')
      tempDirs.push(tempDir)
      await unpackMod(inputPath, tempDir)
      const xmlFiles = findLocalizationXmls(tempDir, sourceFolder)
      if (xmlFiles.length === 0)
        throw new Error(`No XML found for language "${sourceFolder}" in pak`)
      xmlPath = xmlFiles[0]
    } else if (ext === '.zip') {
      post({ phase: 'unpacking' })
      const archiveDir = createTempDir('icosa_zip')
      tempDirs.push(archiveDir)
      extract(inputPath, archiveDir)
      const pakFiles = findPakFiles(archiveDir)
      if (pakFiles.length === 0) throw new Error('No .pak file found inside zip')
      const unpackedDir = createTempDir('icosa_pak')
      tempDirs.push(unpackedDir)
      await unpackMod(pakFiles[0], unpackedDir)
      const xmlFiles = findLocalizationXmls(unpackedDir, sourceFolder)
      if (xmlFiles.length === 0)
        throw new Error(`No XML found for language "${sourceFolder}" in pak`)
      xmlPath = xmlFiles[0]
    } else {
      throw new Error(`Unsupported file type: ${ext}. Use .xml, .pak, or .zip`)
    }

    post({ phase: 'parsing' })
    const localizationEntries = parseLocalizationXml(xmlPath)
    const total = localizationEntries.length
    const result: XmlEntry[] = new Array(total)

    post({ phase: 'loading-cache' })
    const priorityMods = new ModRepository(db).getPriorityOrdered()
    const index = new DictionaryRepository(db).loadMatchIndex(
      sourceLang,
      targetLang,
      null,
      priorityMods
    )

    for (let i = 0; i < total; i += MATCH_CHUNK) {
      const end = Math.min(i + MATCH_CHUNK, total)
      for (let j = i; j < end; j++) {
        const entry = localizationEntries[j]
        const uiEntry = toUiEntry(entry)
        const match = index.resolve({
          modName: modName ?? null,
          uid: entry.contentuid,
          sourceText: entry.text
        })
        result[j] = match
          ? {
              ...uiEntry,
              target: decodeEntities(getDictionaryTargetText(match.entry, sourceLang, targetLang)),
              matchType: match.matchType
            }
          : { ...uiEntry, target: '', matchType: 'none' }
      }
      post({ phase: 'matching', processed: end, total })
      await new Promise<void>((resolve) => setImmediate(resolve))
    }

    post({ phase: 'done', result: { entries: result } })
  } finally {
    for (const tempDir of tempDirs) cleanupTempDir(tempDir)
    sqlite.close()
  }
}
