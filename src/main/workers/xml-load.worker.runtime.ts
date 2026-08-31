import path from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import {
  DictionaryRepository,
  getDictionaryTargetText
} from '../database/repositories/dictionary.repo'
import { ModRepository } from '../database/repositories/mod.repo'
import { SourceFileRepository } from '../database/repositories/source-file.repo'
import * as schema from '../database/schema'
import { applySqlitePragmas } from '../database/sqlite-pragmas'
import { unpackMod } from '../services/lslib.service'
import { decodeEntities } from '../services/xml-entities.service'
import {
  findLocalizationXmls,
  parseLocalizationFile,
  type LocalizationEntry
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
  // Original localization file this entry came from (basename, e.g. "Spells.xml",
  // "brazilianportuguese.loca"). Drives the per-file column/filter and exports.
  sourceFile: string | null
  sourceFileType: 'xml' | 'loca' | null
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

interface ParsedFile {
  fileName: string
  fileType: 'xml' | 'loca'
  entries: LocalizationEntry[]
}

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

    let files: { fileName: string; fileType: 'xml' | 'loca'; entries: LocalizationEntry[] }[]

    if (ext === '.xml' || ext === '.loca') {
      post({ phase: 'parsing' })
      // .loca input: the user imported a binary file directly - parse in place.
      const entries = parseLocalizationFile(inputPath)
      files = [
        {
          fileName: path.basename(inputPath),
          fileType: ext === '.loca' ? 'loca' : 'xml',
          entries
        }
      ]
    } else if (ext === '.pak') {
      post({ phase: 'unpacking' })
      const tempDir = createTempDir('icosa_xml')
      tempDirs.push(tempDir)
      await unpackMod(inputPath, tempDir)
      files = readAllLocalizationFiles(tempDir, sourceFolder, post)
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
      files = readAllLocalizationFiles(unpackedDir, sourceFolder, post)
    } else {
      throw new Error(`Unsupported file type: ${ext}. Use .xml, .loca, .pak, or .zip`)
    }

    const total = files.reduce((sum, file) => sum + file.entries.length, 0)
    const result: XmlEntry[] = new Array(total)

    post({ phase: 'loading-cache' })
    const priorityMods = new ModRepository(db).getPriorityOrdered()
    const index = new DictionaryRepository(db).loadMatchIndex(
      sourceLang,
      targetLang,
      null,
      priorityMods
    )

    // Persist the per-file split: one mod_source row per file (getOrCreate is a single
    // indexed lookup on repeat imports - no duplicate rows for renamed files).
    const sourceFileIdByName = new Map<string, number>()
    if (modName) {
      const sourceRepo = new SourceFileRepository(db)
      const modRepo = new ModRepository(db)
      modRepo.upsert(modName)
      for (const file of files) {
        sourceFileIdByName.set(
          file.fileName.toLowerCase(),
          sourceRepo.getOrCreate(modName, file.fileName, file.fileType)
        )
      }
    }

    let cursor = 0
    for (const file of files) {
      for (const entry of file.entries) {
        const uiEntry = toUiEntry(entry)
        const match = index.resolve({
          modName: modName ?? null,
          uid: entry.contentuid,
          sourceText: entry.text
        })
        result[cursor] = match
          ? {
              ...uiEntry,
              target: decodeEntities(getDictionaryTargetText(match.entry, sourceLang, targetLang)),
              matchType: match.matchType,
              sourceFile: file.fileName,
              sourceFileType: file.fileType
            }
          : {
              ...uiEntry,
              target: '',
              matchType: 'none',
              sourceFile: file.fileName,
              sourceFileType: file.fileType
            }
        cursor++
      }
    }

    // Emit progress in chunks (cheap, keep the loop allocation-free per batch).
    for (let i = 0; i < total; i += MATCH_CHUNK) {
      post({ phase: 'matching', processed: Math.min(i + MATCH_CHUNK, total), total })
      await new Promise<void>((resolve) => setImmediate(resolve))
    }

    post({ phase: 'done', result: { entries: result } })
  } finally {
    for (const tempDir of tempDirs) cleanupTempDir(tempDir)
    sqlite.close()
  }
}

// Every .xml AND .loca inside Localization/{sourceFolder}/ - the tab views are built
// from the file types actually found. .loca entries are decoded to raw text.
function readAllLocalizationFiles(
  rootDir: string,
  sourceFolder: string,
  post: (msg: XmlLoadProgress) => void
): ParsedFile[] {
  const paths = findLocalizationXmls(rootDir, sourceFolder)
  const files: ParsedFile[] = []
  for (const filePath of paths) {
    const fileName = path.basename(filePath)
    const fileType: 'xml' | 'loca' = fileName.toLowerCase().endsWith('.loca') ? 'loca' : 'xml'
    post({ phase: 'parsing' })
    files.push({ fileName, fileType, entries: parseLocalizationFile(filePath) })
  }
  if (files.length === 0) {
    throw new Error(`No localization files found for language "${sourceFolder}" in pak`)
  }
  return files
}

interface ParsedFile {
  fileName: string
  fileType: 'xml' | 'loca'
  entries: LocalizationEntry[]
}